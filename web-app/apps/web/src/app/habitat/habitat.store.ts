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
  footprintTiles,
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

  /** "+" over an empty plot under the pointer, so plantable spots are self-evident. */
  readonly ghost = computed(() => {
    const h = this.hover();
    if (h?.type !== 'PLOT_SELECTED' || this.garden.pickerTile() || this.garden.closeupId()) return null;
    return this.garden.isEmptyPlot(h) ? { x: h.x, y: h.y, texture: HINT_TEXTURE } : null;
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
