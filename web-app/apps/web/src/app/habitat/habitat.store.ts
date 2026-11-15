import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GARDEN_ROOM,
  HabitatInteraction,
  InsightsDisplayState,
  MedicalTerminalState,
  PropInteraction,
  ROOMS,
  PlacedDecor,
  decorSpec,
  pottedPlantOf,
  TileCoord,
  TileRect,
  decorAt,
  decorRect,
  distanceToRect,
  footprintTiles,
  getCatalogItem,
  getPlantStage,
  getTileKind,
  isThirsty,
  isThriving,
  objectRect,
  propAtTile,
  propInteraction,
  tileOf,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import {
  HINT_TEXTURE,
  NOTE_BUBBLE_TEXTURE,
  NOTE_TEXTURES,
  PLAYER_FRAMES,
  PLAYER_TEXTURE,
  crewPoseKey,
  hasCrewPoses,
  THIRST_TEXTURE,
  POT_SIZE,
  POT_FRONT_TEXTURE,
  getAsset,
  decorTextureKey,
  plantSways,
  plantTextureKey,
  propPulses,
  propTextureKey,
} from '../garden/game/asset-registry';
import { PlayerStore, WAVE_MS } from './player.store';
import { DecorStore } from '../decor/decor.store';
import { NpcActorStore, NpcView } from '../npc/npc-actor.store';
import { NPC_IDENTITY } from '../npc/npc-identity';
import { NpcStore } from '../npc/npc.store';
import type { ActorAnim, HabitatRenderState, RenderActor, RenderDecal, RenderSprite } from '../garden/game/habitat.scene';
import { BUBBLE_AT, NOTE_SLOTS } from '../garden/game/notice-board';
import { NotesStore } from '../social/notes.store';

/** A popup: a station's (opened from its prop), or one opened from the top bar (the inventory). */
export type HabitatPanel = PropInteraction | 'INVENTORY';

/** Something the player can use from where they stand. */
export interface Reachable {
  interaction: HabitatInteraction;
  rect: TileRect;
  /** What the action button will do, e.g. "Open Medical Terminal". */
  label: string;
}

/**
 * A potted plant: the pot, the plant's own map art (same size as in the garden, swaying the same way)
 * with its base this many px below the pot's top edge, then the pot's front lip over it. The lip
 * hides most of the soil mound baked into the art, so the plant grows out of the pot.
 */
const POTTED_PLANT_BASE = 16;
const POT_FRONT_DECAL: RenderDecal = { texture: POT_FRONT_TEXTURE, dx: POT_SIZE[0] / 2, dy: POT_SIZE[1] / 2 };

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
  private readonly npcs = inject(NpcActorStore);
  private readonly npcDialogue = inject(NpcStore);
  private readonly notes = inject(NotesStore);
  private readonly decor = inject(DecorStore);
  /** NPCs in the room on screen. Unchanged while only NPCs in other rooms move, so those don't redraw this one. */
  private readonly npcsHere = computed(() => this.npcs.view().filter((c) => c.position.room === this.activeRoom()), {
    equal: (a: readonly NpcView[], b: readonly NpcView[]) => a.length === b.length && a.every((v, i) => v === b[i]),
  });

  /** The room on screen: wherever the local player is. */
  readonly activeRoom = computed(() => this.player.room());
  private readonly roomProps = computed(() => ROOMS[this.activeRoom()].props);

  readonly hover = signal<HabitatInteraction | null>(null);
  readonly selection = signal<HabitatInteraction | null>(null);
  readonly openPanel = signal<HabitatPanel | null>(null);
  /** A tab the next panel should open on (e.g. the store's Messages tab); that panel takes it once. */
  readonly panelTab = signal<string | null>(null);
  /** Something is open over the room (a panel, plant close-up or picker), so NPCs shouldn't walk over to chat. */
  readonly busy = computed(() => !!(this.openPanel() || this.garden.closeupId() || this.garden.pickerTile() || this.decor.active()));
  /** Debug aid for the layout checkpoint: outline zones and footprints. */
  readonly showLayout = signal(false);

  /** Visual state per stateful prop kind. */
  readonly propStates = {
    MEDICAL_TERMINAL: signal<MedicalTerminalState>('idle'),
    HEALTH_INSIGHTS: signal<InsightsDisplayState>('idle'),
  } as const;

  /**
   * What's pinned on the message board: one note per slot, newest first, coloured by who wrote
   * it. With more notes than slots, the last slot becomes a "+" stack. Unread → floating bubble.
   */
  private readonly boardNotes = computed<Pick<RenderSprite, 'decals' | 'badge' | 'badgeAt'>>(() => {
    const notes = this.notes.newestFirst();
    const overflow = notes.length > NOTE_SLOTS.length;
    const shown = overflow ? notes.slice(0, NOTE_SLOTS.length - 1) : notes;
    const decals: RenderDecal[] = shown.map((n, i) => ({
      texture: this.notes.fromAstronaut(n) ? NOTE_TEXTURES.astronaut : NOTE_TEXTURES.family,
      ...NOTE_SLOTS[i],
    }));
    if (overflow) decals.push({ texture: NOTE_TEXTURES.more, ...NOTE_SLOTS[shown.length] });
    return { decals, badge: this.notes.unread() ? NOTE_BUBBLE_TEXTURE : undefined, badgeAt: BUBBLE_AT };
  });

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
        ...(p.kind === 'MESSAGE_BOARD' ? this.boardNotes() : {}),
      });
    }

    const moving = this.decor.movingId();
    for (const d of this.garden.decorations()) {
      if (d.room !== room || d.id === moving) continue; // the one being moved shows as the preview instead
      sprites.push({
        id: `decor:${d.id}`,
        texture: decorTextureKey(d.itemId),
        ...decorRect(d),
        interaction: { type: 'DECOR_SELECTED', decorId: d.id },
        flat: decorSpec(d.itemId)?.flat,
        ...this.potLook(d, now),
      });
    }

    const wetTiles: TileCoord[] = [];
    for (const o of room === GARDEN_ROOM ? this.garden.objects() : []) {
      const rect = objectRect(o);
      const stage = getPlantStage(o, now);
      const thirsty = isThirsty(o, now);
      sprites.push({
        id: o.id,
        texture: plantTextureKey(o.itemType, stage),
        ...rect,
        interaction: { type: 'PLANT_SELECTED', plantId: o.id },
        sway: stage === 'MATURE' && plantSways(o.itemType),
        // A friendly "a drink would help" bubble; the plant itself never looks sad.
        badge: thirsty ? THIRST_TEXTURE : undefined,
        // Every need met (watered + pruned): a soft shine. Otherwise plain, never sad.
        shine: isThriving(o, now),
      });
      // Thirsty plants show dry soil too.
      if (!thirsty) wetTiles.push(...footprintTiles(rect));
    }

    return { room, sprites, wetTiles };
  });

  /** A potted plant: the grown plant stands in the pot (pinned on it), and shines once watered. */
  private potLook(d: PlacedDecor, now: number): Pick<RenderSprite, 'decals' | 'shine'> {
    const plant = pottedPlantOf(d.itemId);
    if (!plant) return {};
    const texture = plantTextureKey(plant, 'MATURE');
    const height = getAsset(texture)?.height ?? 64;
    const plantDecal = { texture, dx: POT_SIZE[0] / 2, dy: POTTED_PLANT_BASE - height / 2, sway: plantSways(plant) };
    return { decals: [plantDecal, POT_FRONT_DECAL], shine: !isThirsty(d, now) };
  }

  /** Moving characters in the active room. Updates every frame, separately from the room. */
  readonly actors = computed<RenderActor[]>(() => {
    const speaking = this.npcDialogue.current()?.speaker;
    const actors: RenderActor[] = this.npcsHere().map((n) => {
      const posed = n.id !== 'SPROUT' && hasCrewPoses(n.id);
      return {
        id: `npc:${n.id}`,
        texture: posed && n.id !== 'SPROUT' ? crewPoseKey(n.id, n.facing, speaking === n.id) : NPC_IDENTITY[n.id].texture,
        x: n.position.x,
        y: n.position.y,
        flipX: posed ? false : n.facingLeft, // posed art is drawn for each way it faces
        moving: n.moving,
        interaction: { type: 'NPC_SELECTED', npcId: n.id },
        float: n.id !== 'SPROUT', // the crew are robots: they hover
      };
    });
    const { x, y } = this.player.position();
    actors.push({
      id: 'player',
      texture: PLAYER_TEXTURE,
      x,
      y,
      flipX: false,
      moving: this.player.moving(),
      interaction: null,
      anim: this.playerAnim(),
    });
    return actors;
  });

  /** Walking: four frames in the way they face. Standing: that direction's standing pose. Waving: the wave, twice. */
  private readonly playerAnim = computed<ActorAnim>(() => {
    const waveAt = this.player.waveAt();
    if (waveAt !== null && !this.player.moving() && PLAYER_FRAMES.wave.length) {
      return { frames: [...PLAYER_FRAMES.wave, ...PLAYER_FRAMES.wave], fps: (2 * PLAYER_FRAMES.wave.length * 1000) / WAVE_MS, loop: false, startedAt: waveAt };
    }
    const facing = this.player.facing();
    return this.player.moving()
      ? { frames: PLAYER_FRAMES.walk[facing], fps: 8, loop: true, startedAt: 0 }
      : { frames: [PLAYER_FRAMES.idle[facing]], fps: 1, loop: false, startedAt: 0 };
  });

  readonly hoverRect = computed(() => this.targetRect(this.hover()));
  readonly selectionRect = computed(() => {
    if (this.decor.active()) return this.decor.focusRect();
    const s = this.selection();
    return s?.type === 'NPC_SELECTED' ? null : this.targetRect(s);
  });

  /** Soil tiles of the garden room, for finding the nearest free plot. Static. */
  private readonly soilTiles: TileCoord[] = (() => {
    const tiles: TileCoord[] = [];
    ROOMS[GARDEN_ROOM].layout.forEach((row, y) => [...row].forEach((_, x) => getTileKind(GARDEN_ROOM, x, y) === 'SOIL' && tiles.push({ x, y })));
    return tiles;
  })();

  /** The nearest usable thing within reach of the player (stations, plants, free plots, NPCs). */
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
    for (const n of this.npcsHere()) {
      consider({ ...tileOf(n.position), w: 1, h: 1 }, { type: 'NPC_SELECTED', npcId: n.id }, `Talk to ${NPC_IDENTITY[n.id].name}`);
    }
    return best;
  });

  /** "+" over an empty plot under the pointer (or the one in reach), so plantable spots are self-evident. */
  readonly ghost = computed(() => {
    const placing = this.decor.mode();
    if (placing) {
      const rect = this.decor.candidateRect();
      return rect && { ...rect, texture: decorTextureKey(placing.itemId), lift: 0 };
    }
    if (this.garden.pickerTile() || this.garden.closeupId()) return null;
    const h = this.hover();
    const plot = h?.type === 'PLOT_SELECTED' ? h : this.reachable()?.interaction;
    if (plot?.type !== 'PLOT_SELECTED') return null;
    return this.garden.isEmptyPlot(plot) ? { x: plot.x, y: plot.y, w: 1, h: 1, texture: HINT_TEXTURE, lift: 4 } : null;
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

  /**
   * Go to a station from inside another panel: close it, walk over (as tapping the station in
   * the room does) and open it, on `tab` if given.
   */
  visit(panel: PropInteraction, tab?: string): void {
    const target: HabitatInteraction = { type: panel };
    this.openPanel.set(null);
    this.panelTab.set(tab ?? null);
    this.selection.set(target);
    const open = () => this.openPanel.set(panel);
    const rect = this.targetRect(target);
    if (rect) this.player.approach(rect, open);
    else open();
  }

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
      case 'NPC_SELECTED': {
        const at = this.npcs.get(i.npcId)?.position;
        return at ? { ...tileOf(at), w: 1, h: 1 } : null;
      }
      case 'PROP_SELECTED':
        return this.roomProps().find((p) => p.id === i.propId) ?? null;
      case 'DECOR_SELECTED': {
        const d = this.garden.decorations().find((x) => x.id === i.decorId);
        return d ? decorRect(d) : null;
      }
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
    const decor = decorAt(this.garden.decorations(), room, i.x, i.y);
    if (decor) return { type: 'DECOR_SELECTED', decorId: decor.id };
    const prop = propAtTile(room, i.x, i.y);
    if (prop) return propInteraction(prop);
    return i;
  }
}
