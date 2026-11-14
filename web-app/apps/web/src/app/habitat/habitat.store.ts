import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GARDEN_ROOM,
  HabitatInteraction,
  InsightsDisplayState,
  MedicalTerminalState,
  MessageBoardState,
  PropInteraction,
  ROOMS,
  TileCoord,
  TileRect,
  distanceToRect,
  footprintTiles,
  getCatalogItem,
  getPlantStage,
  getTileKind,
  objectRect,
  propAtTile,
  propInteraction,
  tileOf,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import {
  HINT_TEXTURE,
  NPC_TEXTURE,
  PLAYER_TEXTURE,
  plantSways,
  plantTextureKey,
  propPulses,
  propTextureKey,
} from '../garden/game/asset-registry';
import { PlayerStore } from './player.store';
import { NpcActorStore } from '../npc/npc-actor.store';
import type { HabitatRenderState, RenderActor, RenderSprite } from '../garden/game/habitat.scene';

/** A panel is identified by the station interaction that opens it. */
export type HabitatPanel = PropInteraction;

/** Something the player can use from where they stand. */
export interface Reachable {
  interaction: HabitatInteraction;
  rect: TileRect;
  /** What the action button will do, e.g. "Open Medical Terminal". */
  label: string;
}

/** How far from the player's feet something can be and still be usable (tiles, to its nearest edge). */
const REACH = 1.5;

/**
 * Habitat UI state: what is hovered/selected, which panel is open, prop visual
 * states, and the render state handed to Phaser.
 */
@Injectable({ providedIn: 'root' })
export class HabitatStore {
  private readonly garden = inject(GardenStore);
  private readonly player = inject(PlayerStore);
  private readonly npc = inject(NpcActorStore);

  /** The room on screen: wherever the local player is. */
  readonly activeRoom = computed(() => this.player.room());
  private readonly roomProps = computed(() => ROOMS[this.activeRoom()].props);

  readonly hover = signal<HabitatInteraction | null>(null);
  readonly selection = signal<HabitatInteraction | null>(null);
  readonly openPanel = signal<HabitatPanel | null>(null);
  /** Debug aid for the layout checkpoint: outline zones and footprints. */
  readonly showLayout = signal(false);

  /** Visual state per stateful prop kind. */
  readonly propStates = {
    MEDICAL_TERMINAL: signal<MedicalTerminalState>('idle'),
    HEALTH_INSIGHTS: signal<InsightsDisplayState>('idle'),
    MESSAGE_BOARD: signal<MessageBoardState>('idle'),
  } as const;

  readonly renderState = computed<HabitatRenderState>(() => {
    const room = this.activeRoom();
    const now = this.garden.now();
    const sprites: RenderSprite[] = [];

    for (const p of this.roomProps()) {
      const state = this.propStates[p.kind as keyof typeof this.propStates]?.();
      sprites.push({
        id: `prop:${p.id}`,
        texture: propTextureKey(p.kind, state),
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        interaction: propInteraction(p),
        pulse: propPulses(p.kind, state),
      });
    }

    const wetTiles: TileCoord[] = [];
    for (const o of room === GARDEN_ROOM ? this.garden.objects() : []) {
      const rect = objectRect(o);
      const stage = getPlantStage(o, now);
      sprites.push({
        id: o.id,
        texture: plantTextureKey(o.itemType, stage),
        ...rect,
        interaction: { type: 'PLANT_SELECTED', plantId: o.id },
        sway: stage === 'MATURE' && plantSways(o.itemType),
      });
      wetTiles.push(...footprintTiles(rect));
    }

    return { room, sprites, wetTiles };
  });

  /** Moving characters in the active room. Updates every frame, separately from the room. */
  readonly actors = computed<RenderActor[]>(() => {
    const actors: RenderActor[] = [];
    if (this.activeRoom() === this.npc.room) {
      actors.push({
        id: 'npc',
        texture: NPC_TEXTURE,
        ...this.npc.position(),
        flipX: this.npc.facingLeft(),
        moving: this.npc.moving(),
        interaction: { type: 'NPC_SELECTED' },
      });
    }
    const { x, y } = this.player.position();
    actors.push({ id: 'player', texture: PLAYER_TEXTURE, x, y, flipX: this.player.facingLeft(), moving: this.player.moving(), interaction: null });
    return actors;
  });

  readonly hoverRect = computed(() => this.targetRect(this.hover()));
  readonly selectionRect = computed(() => {
    const s = this.selection();
    return s?.type === 'NPC_SELECTED' ? null : this.targetRect(s);
  });

  /** Soil tiles of the garden room, for finding the nearest free plot. Static. */
  private readonly soilTiles: TileCoord[] = (() => {
    const tiles: TileCoord[] = [];
    ROOMS[GARDEN_ROOM].layout.forEach((row, y) => [...row].forEach((_, x) => getTileKind(GARDEN_ROOM, x, y) === 'SOIL' && tiles.push({ x, y })));
    return tiles;
  })();

  /** The nearest usable thing within reach of the player (stations, plants, free plots, Sprout). */
  readonly reachable = computed<Reachable | null>(() => {
    const room = this.activeRoom();
    const feet = this.player.position();
    let best: Reachable | null = null;
    let bestDist = REACH;
    const consider = (rect: TileRect, interaction: HabitatInteraction, label: string) => {
      const d = distanceToRect(feet, rect);
      if (d <= bestDist) {
        bestDist = d;
        best = { rect, interaction, label };
      }
    };

    for (const p of this.roomProps()) {
      if (p.interaction) consider(p, { type: p.interaction }, `Open ${p.name}`);
    }
    if (room === GARDEN_ROOM) {
      for (const o of this.garden.objects()) {
        consider(objectRect(o), { type: 'PLANT_SELECTED', plantId: o.id }, `Look at ${getCatalogItem(o.itemType)?.name ?? 'plant'}`);
      }
      const underfoot = tileOf(feet);
      for (const t of this.soilTiles) {
        if (t.x === underfoot.x && t.y === underfoot.y) continue; // plant in front of you, not on your toes
        if (this.garden.isEmptyPlot(t)) consider({ ...t, w: 1, h: 1 }, { type: 'PLOT_SELECTED', ...t }, 'Plant here');
      }
    }
    if (room === this.npc.room) {
      consider({ ...tileOf(this.npc.position()), w: 1, h: 1 }, { type: 'NPC_SELECTED' }, 'Talk to Sprout');
    }
    return best;
  });

  /** "+" over an empty plot under the pointer (or the one in reach), so plantable spots are self-evident. */
  readonly ghost = computed(() => {
    if (this.garden.pickerTile() || this.garden.closeupId()) return null;
    const h = this.hover();
    const plot = h?.type === 'PLOT_SELECTED' ? h : this.reachable()?.interaction;
    if (plot?.type !== 'PLOT_SELECTED') return null;
    return this.garden.isEmptyPlot(plot) ? { x: plot.x, y: plot.y, texture: HINT_TEXTURE } : null;
  });

  /** Info for the "Look closer" panel when a plain tile or decoration is selected. */
  readonly selectedInfo = computed(() => {
    const s = this.selection();
    if (!s) return null;
    const room = ROOMS[this.activeRoom()];
    if (s.type === 'PROP_SELECTED') {
      const prop = room.props.find((p) => p.id === s.propId);
      return prop ? { title: prop.name, roomName: room.name, kind: null } : null;
    }
    if (s.type === 'TILE_SELECTED' || s.type === 'PLOT_SELECTED') {
      return { title: null, roomName: room.name, kind: getTileKind(room.id, s.x, s.y) ?? null };
    }
    return null;
  });

  /** Footprint of whatever an interaction refers to (what the player walks up to). */
  targetRect(i: HabitatInteraction | null): TileRect | null {
    if (!i) return null;
    switch (i.type) {
      case 'PLANT_SELECTED': {
        const o = this.garden.objects().find((p) => p.id === i.plantId);
        return o ? objectRect(o) : null;
      }
      case 'PLOT_SELECTED':
      case 'TILE_SELECTED':
        return { x: i.x, y: i.y, w: 1, h: 1 };
      case 'NPC_SELECTED':
        return { ...tileOf(this.npc.position()), w: 1, h: 1 };
      case 'PROP_SELECTED':
        return this.roomProps().find((p) => p.id === i.propId) ?? null;
      default:
        return this.roomProps().find((p) => p.interaction === i.type) ?? null;
    }
  }

  /**
   * Resolve tile clicks to what is actually there (a plant's transparent pixels,
   * or a prop's footprint), so every click lands on the obvious target.
   */
  resolve(i: HabitatInteraction): HabitatInteraction {
    if (i.type !== 'TILE_SELECTED' && i.type !== 'PLOT_SELECTED') return i;
    const room = this.activeRoom();
    const plant = room === GARDEN_ROOM ? this.garden.plantAt(i) : undefined;
    if (plant) return { type: 'PLANT_SELECTED', plantId: plant.id };
    const prop = propAtTile(room, i.x, i.y);
    if (prop) return propInteraction(prop);
    return i;
  }
}
