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
  isCrew,
  isPet,
  PetId,
  isThirsty,
  isThriving,
  objectRect,
  propAtTile,
  propInteraction,
  tileOf,
  emoteGlyph,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import {
  HINT_TEXTURE,
  NOTE_BUBBLE_TEXTURE,
  NOTE_TEXTURES,
  PET_FRAMES,
  SUIT_FRAMES,
  astronautAnim,
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
  propSways,
  propTextureKey,
} from '../garden/game/asset-registry';
import { PlayerStore, WAVE_MS } from './player.store';
import { PresenceStore } from './presence.store';
import { DecorStore } from '../decor/decor.store';
import { NpcActorStore, NpcView } from '../npc/npc-actor.store';
import { NPC_IDENTITY } from '../npc/npc-identity';
import { NpcStore } from '../npc/npc.store';
import type { ActorAnim, HabitatRenderState, RenderActor, RenderDecal, RenderSprite } from '../garden/game/habitat.scene';
import { CURRENT_USER, MY_SUIT } from '../session/current-user';
import { BUBBLE_AT, NOTE_SLOTS } from '../garden/game/notice-board';
import { NotesStore } from '../social/notes.store';
import { t } from '../i18n/i18n';

/** A pet: trotting frames the way it's heading, else standing that way. A bit quicker than the astronaut's step. */
const petAnim = (id: PetId, n: NpcView): ActorAnim =>
  n.moving
    ? { frames: PET_FRAMES[id].walk[n.facing], fps: 10, loop: true, startedAt: 0 }
    : { frames: [PET_FRAMES[id].idle[n.facing]], fps: 1, loop: false, startedAt: 0 };

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
  private readonly presence = inject(PresenceStore);
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

  /**
   * Named plants whose sign shows the name: every one within reach of the player, and the one the
   * pointer is on. A string of ids, so walking (or pointing at unnamed plants) only redraws the room
   * when the set changes.
   */
  private readonly openSigns = computed(() => {
    if (this.activeRoom() !== GARDEN_ROOM) return '';
    const h = this.hover();
    const pointed = h?.type === 'PLANT_SELECTED' ? h.plantId : null;
    const feet = this.player.position();
    const ids = this.garden.objects().filter((o) => o.label && (o.id === pointed || distanceToRect(feet, objectRect(o)) <= REACH));
    return ids.map((o) => o.id).join(' ');
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
        sway: propSways(p.kind),
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
    const openSigns = new Set(this.openSigns().split(' '));
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
        sign: o.label ? { text: o.label, open: openSigns.has(o.id) } : undefined,
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
      const crew = isCrew(n.id) ? n.id : null;
      const pet = isPet(n.id) ? n.id : null;
      const posed = pet !== null || (crew !== null && hasCrewPoses(crew));
      return {
        id: `npc:${n.id}`,
        texture: crew && posed ? crewPoseKey(crew, n.facing, speaking === n.id) : NPC_IDENTITY[n.id].texture,
        x: n.position.x,
        y: n.position.y,
        flipX: posed ? false : n.facingLeft, // posed art is drawn for each way it faces
        moving: n.moving,
        interaction: { type: 'NPC_SELECTED', npcId: n.id },
        float: crew !== null, // the crew are robots: they hover
        anim: pet ? petAnim(pet, n) : undefined, // pets trot like the astronaut walks
      };
    });
    // Everyone else in the station who is in this room, in their own suits.
    for (const p of this.presence.others()) {
      if (p.stance.at.room !== this.activeRoom()) continue;
      const frames = SUIT_FRAMES[p.member.suit] ?? SUIT_FRAMES.turquoise;
      actors.push({
        id: `peer:${p.peer}`,
        texture: frames.idle.down,
        x: p.x,
        y: p.y,
        flipX: false,
        moving: p.moving,
        interaction: null,
        anim: astronautAnim(frames, { facing: p.stance.facing, moving: p.moving, waveAt: p.waveAt }, WAVE_MS),
        shadow: true,
        label: p.member.name,
        emote: p.emote ? { glyph: emoteGlyph(p.emote.id), at: p.emote.at } : undefined,
      });
    }
    const { x, y } = this.player.position();
    actors.push({
      id: 'player',
      texture: SUIT_FRAMES[MY_SUIT()].idle.down,
      x,
      y,
      flipX: false,
      moving: this.player.moving(),
      interaction: null,
      anim: this.playerAnim(),
      shadow: true,
      label: CURRENT_USER.displayName,
      emote: this.playerEmote(),
    });
    return actors;
  });

  private readonly playerEmote = computed(() => {
    const e = this.player.emote();
    return e ? { glyph: emoteGlyph(e.id), at: e.at } : undefined;
  });

  private readonly playerAnim = computed<ActorAnim>(() =>
    astronautAnim(SUIT_FRAMES[MY_SUIT()], { facing: this.player.facing(), moving: this.player.moving(), waveAt: this.player.waveAt() }, WAVE_MS),
  );

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
      if (p.interaction) consider(p, { type: p.interaction }, t('Open {name}', { name: t(p.name) }));
    }
    if (room === GARDEN_ROOM) {
      for (const o of this.garden.objects()) {
        consider(objectRect(o), { type: 'PLANT_SELECTED', plantId: o.id }, t('Look at {name}', { name: t(getCatalogItem(o.itemType)?.name ?? 'plant') }));
      }
      const underfoot = tileOf(feet);
      const plantHere = t('Plant here');
      for (const tile of this.soilTiles) {
        if (tile.x === underfoot.x && tile.y === underfoot.y) continue; // plant in front of you, not on your toes
        if (this.garden.isEmptyPlot(tile)) consider({ ...tile, w: 1, h: 1 }, { type: 'PLOT_SELECTED', ...tile }, plantHere);
      }
    }
    for (const n of this.npcsHere()) {
      consider({ ...tileOf(n.position), w: 1, h: 1 }, { type: 'NPC_SELECTED', npcId: n.id }, t(isPet(n.id) && n.id !== 'RADISH' ? 'Pet {name}' : 'Talk to {name}', { name: NPC_IDENTITY[n.id].name }));
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
      return prop ? { title: t(prop.name), roomName: t(room.name), kind: null } : null;
    }
    if (s.type === 'TILE_SELECTED' || s.type === 'PLOT_SELECTED') {
      return { title: null, roomName: t(room.name), kind: getTileKind(room.id, s.x, s.y) ?? null };
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
