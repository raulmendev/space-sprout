/**
 * Centralised asset registry: the single place that knows asset IDs, file
 * paths, native sizes, anchors and placeholders.
 *
 * To deliver final art: drop `public/assets/game/<folder>/<key>.png` and add
 * `<key>` to `public/assets/game/manifest.json` → `delivered`. No code changes.
 */
import {
  ALL_PROPS,
  CLAY_POT,
  CrewId,
  FERTILIZER,
  PlantStage,
  ROOMS,
  ROOM_COLS,
  ROOM_ROWS,
  RoomId,
  TILE_SIZE,
  TileKind,
  getCatalogItem,
  plantStages,
  pottedPlantOf,
} from '@garden/shared';
import { closeupPlantArt, closeupSoilArt } from './closeup-art';
import type { Suit } from '@garden/shared';
import { SUIT } from '../../session/current-user';
import { BOARD_SIZE, NOTE_COLORS, NOTE_SIZE, noteBubbleArt, noteStackArt, stickyNoteArt } from './notice-board';
import {
  ASTRONAUT,
  HINT_PLUS,
  MATURE_GRIDS,
  NPC_SPROUT,
  SEED,
  SPROUT,
  THIRST_BUBBLE,
  TWINKLE,
  TILE_PLACEHOLDERS,
  crewGrid,
  gridInCanvas,
  gridToCanvas,
  grassTile,
  hedgeTile,
  labelledBox,
  pathTile,
  soilTile,
  tallTree,
  wetSoilTile,
  woodPathTile,
  DECOR_ART,
  potArt,
  potFrontArt,
} from './placeholders';

const ASSET_ROOT = 'assets/game';
export const MANIFEST_URL = `${ASSET_ROOT}/manifest.json`;

interface SpriteAsset {
  key: string;
  path: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

/** Canvas, or a data URL for UI-only assets; null when the fallback isn't a picture (see rooms). */
type Placeholder = (() => HTMLCanvasElement | string) | null;

interface RegistryEntry extends SpriteAsset {
  placeholder: Placeholder;
  /** Only shown in Angular (e.g. close-up previews); the Phaser scene skips it. */
  uiOnly: boolean;
}

const REGISTRY = new Map<string, RegistryEntry>();

function register(
  key: string,
  folder: string,
  size: [number, number],
  origin: [number, number],
  placeholder: Placeholder,
  uiOnly = false,
): void {
  REGISTRY.set(key, {
    uiOnly,
    key,
    path: `${ASSET_ROOT}/${folder}/${key}.png`,
    width: size[0],
    height: size[1],
    originX: origin[0],
    originY: origin[1],
    placeholder,
  });
}

const TERRAIN: [number, number] = [0, 0];
const BOTTOM_CENTER: [number, number] = [0.5, 1];

// ---------------------------------------------------------------- tiles

const kebab = (s: string) => s.toLowerCase().replace(/_/g, '-');
const FLOORS = 'habitat/floors';
const WALLS = 'habitat/walls';

/** One row per tile kind: where its PNG lives and its placeholder. Complete by type. */
const TILES: Record<TileKind, { folder: string; variants?: number; art: (variant: number) => HTMLCanvasElement }> = {
  GRASS: { folder: FLOORS, variants: 4, art: (v) => grassTile(11 + v, false) },
  GRASS_FLOWERS: { folder: FLOORS, art: () => grassTile(31, true) },
  PATH_STONE: { folder: FLOORS, art: () => pathTile(71) },
  PATH_WOOD: { folder: FLOORS, art: woodPathTile },
  FLOOR_MEDICAL: { folder: FLOORS, art: TILE_PLACEHOLDERS['FLOOR_MEDICAL'] },
  FLOOR_SOCIAL: { folder: FLOORS, art: TILE_PLACEHOLDERS['FLOOR_SOCIAL'] },
  RUG: { folder: FLOORS, art: TILE_PLACEHOLDERS['RUG'] },
  SOIL: { folder: 'garden/plots', art: () => soilTile(51) },
  HEDGE: { folder: WALLS, art: () => hedgeTile(91) },
  WALL: { folder: WALLS, art: TILE_PLACEHOLDERS['WALL'] },
  WALL_FACE: { folder: WALLS, art: TILE_PLACEHOLDERS['WALL_FACE'] },
  WINDOW: { folder: WALLS, art: TILE_PLACEHOLDERS['WINDOW'] },
  WINDOW_EARTH_L: { folder: WALLS, art: TILE_PLACEHOLDERS['WINDOW_EARTH_L'] },
  WINDOW_EARTH_R: { folder: WALLS, art: TILE_PLACEHOLDERS['WINDOW_EARTH_R'] },
  GLASS_PARTITION: { folder: WALLS, art: TILE_PLACEHOLDERS['GLASS_PARTITION'] },
  LOW_WALL: { folder: WALLS, art: TILE_PLACEHOLDERS['LOW_WALL'] },
  DOORWAY: { folder: 'habitat/transitions', art: TILE_PLACEHOLDERS['DOORWAY'] },
};

export function tileTextureKey(kind: TileKind, x: number, y: number): string {
  const variants = TILES[kind].variants;
  return variants ? `tile-${kebab(kind)}-${(x * 7 + y * 13) % variants}` : `tile-${kebab(kind)}`;
}
export const WET_SOIL_TEXTURE = 'tile-soil-wet';

for (const [kind, t] of Object.entries(TILES) as [TileKind, (typeof TILES)[TileKind]][]) {
  if (!t.variants) register(`tile-${kebab(kind)}`, t.folder, [32, 32], TERRAIN, () => t.art(0));
  for (let v = 0; v < (t.variants ?? 0); v++) register(`tile-${kebab(kind)}-${v}`, t.folder, [32, 32], TERRAIN, () => t.art(v));
}
register(WET_SOIL_TEXTURE, 'garden/plots', [32, 32], TERRAIN, () => wetSoilTile(61));

/**
 * A whole room painted as one picture (tools/import_room.py). It replaces the room's tiles;
 * no placeholder, so undelivered rooms keep drawing tile by tile.
 */
export const roomTextureKey = (room: RoomId) => `room-${room.toLowerCase()}`;
for (const room of Object.keys(ROOMS) as RoomId[]) {
  register(roomTextureKey(room), 'habitat/rooms', [ROOM_COLS * TILE_SIZE, ROOM_ROWS * TILE_SIZE], TERRAIN, null);
}

// ---------------------------------------------------------------- plants

interface PlantVisual {
  /** Native size of the mature map sprite. */
  mature: [number, number];
  /** Native size of the earlier map sprites. Default 32x32. */
  growing?: [number, number];
  matureArt: () => HTMLCanvasElement;
  sway: boolean;
  /** The delivered close-up art includes its own soil mound, so the close-up skips the shared one. */
  closeupHasSoil?: boolean;
}

/** Species with design-team art: 64x64 map sprites at every stage, close-ups with their own soil. */
function delivered({ sway = true } = {}): PlantVisual {
  return {
    mature: [64, 64],
    growing: [64, 64],
    matureArt: () => gridInCanvas(MATURE_GRIDS['flower'], 2, 64, 64),
    sway,
    closeupHasSoil: true,
  };
}

/** Per-species visual traits. Adding a plant = one row here (plus a catalog entry). */
const PLANT_VISUALS: Record<string, PlantVisual> = {
  flower: { mature: [32, 32], matureArt: () => gridInCanvas(MATURE_GRIDS['flower'], 2, 32, 32), sway: true },
  sunflower: { mature: [64, 64], matureArt: () => gridInCanvas(MATURE_GRIDS['sunflower'], 4, 64, 64), sway: true },
  tree: { mature: [64, 96], matureArt: tallTree, sway: false },
  mustard: delivered(),
  lettuce: delivered(),
  fern: delivered(),
  nopal: delivered({ sway: false }), // rigid cactus pads
  lily: delivered(),
  rose: delivered(),
  pitcher: delivered(),
  cempasuchil: delivered(),
  monstera: delivered(),
  tulip: delivered(),
  yellowflower: delivered(),
};

export function plantTextureKey(itemType: string, stage: PlantStage): string {
  return `plant-${itemType}-${stage.toLowerCase()}`;
}
export function previewTextureKey(itemType: string, stage: PlantStage): string {
  return `preview-${itemType}-${stage.toLowerCase()}`;
}
export function plantSways(itemType: string): boolean {
  return PLANT_VISUALS[itemType]?.sway ?? false;
}
/** Close-up shown while the plant has every need met. Falls back to the normal close-up until delivered. */
export function glowPreviewTextureKey(itemType: string, stage: PlantStage): string {
  return `${previewTextureKey(itemType, stage)}-glow`;
}
export function closeupHasSoil(itemType: string): boolean {
  return PLANT_VISUALS[itemType]?.closeupHasSoil ?? false;
}
export const PREVIEW_SOIL = 'preview-soil';

for (const [id, v] of Object.entries(PLANT_VISUALS)) {
  for (const stage of plantStages(getCatalogItem(id))) {
    const size = stage === 'MATURE' ? v.mature : (v.growing ?? [32, 32]);
    const art = stage === 'MATURE' ? v.matureArt : () => gridInCanvas(stage === 'SEED' ? SEED : SPROUT, 2, size[0], size[1]);
    register(plantTextureKey(id, stage), 'garden/plants', size, BOTTOM_CENTER, art);
    register(previewTextureKey(id, stage), 'previews', [64, 64], BOTTOM_CENTER, () => closeupPlantArt(id, stage), true);
    register(glowPreviewTextureKey(id, stage), 'previews', [64, 64], BOTTOM_CENTER, () => closeupPlantArt(id, stage), true);
  }
}
register(PREVIEW_SOIL, 'previews', [80, 24], BOTTOM_CENTER, closeupSoilArt, true);

// ---------------------------------------------------------------- habitat props

type Palette = { top: string; front: string; ink: string };
const GARDEN: Palette = { top: '#cfe8b4', front: '#9ccc78', ink: '#2f5a2a' };
const MEDICAL: Palette = { top: '#e6f1fb', front: '#a9cdee', ink: '#24496e' };
const SOCIAL: Palette = { top: '#efe6fa', front: '#c9b6e4', ink: '#4b3470' };

interface PropVisual {
  folder: string;
  size: [number, number];
  palette: Palette;
  /** Visual states: a badge glyph (never colour alone) and whether it pulses for attention. */
  states?: Record<string, { badge: string; pulse?: boolean }>;
}

/** Keyed by HabitatProp.kind. Sprite size may exceed the footprint (e.g. the watering station). */
const PROP_VISUALS: Record<string, PropVisual> = {
  MEDICAL_TERMINAL: {
    folder: 'medical/terminal',
    size: [96, 64],
    palette: MEDICAL,
    states: { idle: { badge: '' }, syncing: { badge: '↻' }, complete: { badge: '✓' }, attention: { badge: '!', pulse: true } },
  },
  HEALTH_INSIGHTS: {
    folder: 'medical/insights',
    size: [96, 64],
    palette: MEDICAL,
    states: { idle: { badge: '' }, new_data: { badge: '•' }, active: { badge: '▸' } },
  },
  // Sizes below are the game sizes tools/import_props.py prints: delivered 2x art is drawn at this size (fitToGame).
  POTTED_PLANT: { folder: 'medical/terminal', size: [45, 73], palette: GARDEN },
  // Notes are separate sprites pinned on it (see notice-board.ts); unread shows as a floating bubble.
  MESSAGE_BOARD: { folder: 'social/board', size: BOARD_SIZE, palette: SOCIAL },
  SUPPLY_STORE: { folder: 'social/store', size: [75, 96], palette: SOCIAL },
  // The lounge, sized to the astronaut (36x50).
  COFFEE_TABLE: { folder: 'social/decorations', size: [80, 49], palette: SOCIAL },
  SOFA: { folder: 'social/decorations', size: [96, 51], palette: SOCIAL },
  ARMCHAIR_LEFT: { folder: 'social/decorations', size: [29, 40], palette: SOCIAL },
  ARMCHAIR_RIGHT: { folder: 'social/decorations', size: [30, 40], palette: SOCIAL },
  POUF_BOTTOM_LEFT: { folder: 'social/decorations', size: [24, 23], palette: SOCIAL },
  POUF_BOTTOM_RIGHT: { folder: 'social/decorations', size: [24, 23], palette: SOCIAL },
  FLOOR_LAMP: { folder: 'social/decorations', size: [12, 45], palette: SOCIAL },
  POT_LAVENDER: { folder: 'social/decorations', size: [27, 38], palette: GARDEN },
  POT_PINK_FLOWERS: { folder: 'social/decorations', size: [24, 30], palette: GARDEN },
  POT_MONSTERA: { folder: 'social/decorations', size: [38, 39], palette: GARDEN },
  PLANTER_LAVENDER: { folder: 'social/decorations', size: [71, 44], palette: GARDEN },
  PLANTER_RED_FLOWERS: { folder: 'social/decorations', size: [54, 43], palette: GARDEN },
  VINES_LEFT: { folder: 'social/decorations', size: [69, 79], palette: SOCIAL },
  VINES_RIGHT: { folder: 'social/decorations', size: [70, 76], palette: SOCIAL },
  // Garden furniture
  WATERING_CAN: { folder: 'garden/decorations', size: [62, 70], palette: GARDEN },
  GREENHOUSE: { folder: 'garden/decorations', size: [94, 61], palette: GARDEN },
  GARDEN_BENCH: { folder: 'garden/decorations', size: [81, 47], palette: GARDEN },
  VINE_ARCH: { folder: 'garden/decorations', size: [69, 66], palette: GARDEN },
  VINE_PLANTER: { folder: 'garden/decorations', size: [64, 52], palette: GARDEN },
};

/** State → texture mapping. Unknown or undelivered states fall back to `idle`. */
export function propTextureKey(kind: string, state?: string): string {
  const visual = PROP_VISUALS[kind];
  const base = `prop-${kebab(kind)}`;
  if (!visual?.states) return base;
  return `${base}-${state && state in visual.states ? state.replace(/_/g, '-') : 'idle'}`;
}

export function propPulses(kind: string, state?: string): boolean {
  return !!(state && PROP_VISUALS[kind]?.states?.[state]?.pulse);
}

for (const [kind, v] of Object.entries(PROP_VISUALS)) {
  const label = ALL_PROPS.find((p) => p.kind === kind)?.name ?? kind;
  const states = v.states ? Object.keys(v.states) : [undefined];
  for (const state of states) {
    const badge = state ? v.states![state].badge : '';
    register(propTextureKey(kind, state), v.folder, v.size, BOTTOM_CENTER, () =>
      labelledBox(v.size[0], v.size[1], v.palette, label, badge || undefined),
    );
  }
}

// ---------------------------------------------------------------- station decorations

/**
 * The pot every potted plant stands in, in two layers: the whole pot (behind the plant) and its
 * front (lip and body, without the opening) drawn over the plant, so the plant sits inside it.
 */
export const POT_TEXTURE = 'decor-pot';
export const POT_FRONT_TEXTURE = 'decor-pot-front';
export const POT_SIZE: [number, number] = [45, 38];
register(POT_TEXTURE, 'social/decorations', POT_SIZE, BOTTOM_CENTER, potArt);
register(POT_FRONT_TEXTURE, 'social/decorations', POT_SIZE, BOTTOM_CENTER, potFrontArt);

/** Map sprite of a placed decoration (e.g. 'photo-frame'); potted plants use the pot. */
export const decorTextureKey = (itemId: string) => (pottedPlantOf(itemId) ? POT_TEXTURE : `decor-${itemId}`);
for (const [itemId, art] of Object.entries(DECOR_ART)) {
  register(decorTextureKey(itemId), 'social/decorations', art.size, BOTTOM_CENTER, art.draw);
}

// ---------------------------------------------------------------- characters & gui

export const NPC_TEXTURE = 'npc-sprout';
export const HINT_TEXTURE = 'gui-hint-plus';
/** The astronaut: four walk frames per direction, a standing pose per direction, and a wave. */
export type Facing = 'down' | 'up' | 'left' | 'right';
export interface PlayerFrames {
  walk: Record<Facing, readonly string[]>;
  /** Standing still, facing the way they last walked. */
  idle: Record<Facing, string>;
  /** Empty when the suit has no wave drawn: the astronaut just stands. */
  wave: readonly string[];
}

/**
 * Each suit colour is its own set of frames, named by colour (player-astronaut-green-*);
 * the original turquoise suit keeps the plain names. Pick one with `?suit=green|black|wine`.
 */
const SUITS: Record<Suit, { prefix: string; size: [number, number]; wave: boolean }> = {
  turquoise: { prefix: 'player-astronaut', size: [36, 50], wave: true },
  green: { prefix: 'player-astronaut-green', size: [40, 50], wave: false },
  black: { prefix: 'player-astronaut-black', size: [38, 50], wave: false },
  wine: { prefix: 'player-astronaut-wine', size: [38, 50], wave: false },
};

function suitFrames(prefix: string, wave: boolean): PlayerFrames {
  const frames = (anim: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${anim}-${i + 1}`);
  return {
    walk: { down: frames('down', 4), up: frames('up', 4), left: frames('left', 4), right: frames('right', 4) },
    idle: { down: `${prefix}-down-idle`, up: `${prefix}-up-idle`, left: `${prefix}-left-idle`, right: `${prefix}-right-idle` },
    wave: wave ? frames('wave', 6) : [],
  };
}

/** Each suit standing, facing the camera (the start menu's suit picker). */
export const suitPortraitKey = (suit: Suit) => `${SUITS[suit].prefix}-down-idle`;

/** The suit this page shows. */
export const PLAYER_FRAMES: PlayerFrames = suitFrames(SUITS[SUIT].prefix, SUITS[SUIT].wave);
/** Standing, facing the camera: the astronaut wherever a single picture is needed. */
export const PLAYER_TEXTURE = PLAYER_FRAMES.idle.down;
export const THIRST_TEXTURE = 'gui-thirst-bubble';
export const TWINKLE_TEXTURE = 'fx-twinkle';
export const NOTE_BUBBLE_TEXTURE = 'gui-note-bubble';
/** Notes pinned on the message board, by who wrote them; `more` stands in for the overflow. */
export const NOTE_TEXTURES = { astronaut: 'note-astronaut', family: 'note-family', more: 'note-more' } as const;
register(NPC_TEXTURE, 'characters', [32, 48], BOTTOM_CENTER, () => gridInCanvas(NPC_SPROUT, 2, 32, 48));
for (const { prefix, size, wave } of Object.values(SUITS)) {
  const f = suitFrames(prefix, wave);
  for (const key of [...Object.values(f.walk).flat(), ...Object.values(f.idle), ...f.wave]) {
    register(key, 'characters', size, BOTTOM_CENTER, () => gridInCanvas(ASTRONAUT, 2, ...size));
  }
}
register(HINT_TEXTURE, 'gui/icons', [32, 32], BOTTOM_CENTER, () => gridToCanvas(HINT_PLUS));
register(THIRST_TEXTURE, 'gui/icons', [32, 32], BOTTOM_CENTER, () => gridToCanvas(THIRST_BUBBLE));
/** Supply Store items drawn by the design team (cards in the store and inventory; others keep their emoji). */
export const storeItemTextureKey = (itemId: string) => `store-${itemId}`;
for (const id of [FERTILIZER, CLAY_POT]) register(storeItemTextureKey(id), 'gui/store', [64, 64], BOTTOM_CENTER, null, true);
/** Station crew (placeholders until the design team's character art lands). */
const CREW_LOOKS: Record<CrewId, Parameters<typeof crewGrid>[0]> = {
  MEDIC: { uniform: 'W', badge: 'R', hair: 'b' },
  TRAINER: { uniform: 'O', badge: 'Y', hair: 'K' },
  CHEF: { uniform: 'W', badge: 'A', hair: 'B', hat: true },
  SCIENTIST: { uniform: 'T', badge: 'Y', hair: 't' },
};
export const crewTextureKey = (id: CrewId) => `npc-${id.toLowerCase()}`;
for (const [id, look] of Object.entries(CREW_LOOKS) as [CrewId, Parameters<typeof crewGrid>[0]][]) {
  register(crewTextureKey(id), 'characters', [32, 48], BOTTOM_CENTER, () => gridInCanvas(crewGrid(look), 2, 32, 48));
}

/**
 * Crew members with delivered art: a standing pose per direction (npc-medic-left) and a happy
 * one they show while talking to you (npc-medic-happy-left). The rest keep the placeholder,
 * mirrored to face left or right.
 */
const CREW_POSES: Partial<Record<CrewId, [number, number]>> = {
  MEDIC: [48, 50],
  SCIENTIST: [48, 50],
  CHEF: [42, 50],
  TRAINER: [48, 50],
};
const FACINGS: readonly Facing[] = ['down', 'up', 'left', 'right'];
export const hasCrewPoses = (id: CrewId): boolean => id in CREW_POSES;
export const crewPoseKey = (id: CrewId, facing: Facing, happy = false) => `npc-${id.toLowerCase()}${happy ? '-happy' : ''}-${facing}`;
/** The crew member's picture for the speech bubble: facing you, when there's art for it. */
export const crewPortraitKey = (id: CrewId) => (hasCrewPoses(id) ? crewPoseKey(id, 'down') : crewTextureKey(id));
for (const [id, size] of Object.entries(CREW_POSES) as [CrewId, [number, number]][]) {
  for (const facing of FACINGS) {
    for (const happy of [false, true]) {
      register(crewPoseKey(id, facing, happy), 'characters', size, BOTTOM_CENTER, () => gridInCanvas(crewGrid(CREW_LOOKS[id]), 2, ...size));
    }
  }
}
register(TWINKLE_TEXTURE, 'gui/effects', [32, 32], [0.5, 0.5], () => gridToCanvas(TWINKLE));
register(NOTE_BUBBLE_TEXTURE, 'gui/icons', [20, 19], BOTTOM_CENTER, noteBubbleArt); // tools/import_board.py size
register(NOTE_TEXTURES.astronaut, 'social/board', [NOTE_SIZE, NOTE_SIZE], [0.5, 0.5], () => stickyNoteArt(NOTE_COLORS.astronaut));
register(NOTE_TEXTURES.family, 'social/board', [NOTE_SIZE, NOTE_SIZE], [0.5, 0.5], () => stickyNoteArt(NOTE_COLORS.family));
register(NOTE_TEXTURES.more, 'social/board', [NOTE_SIZE, NOTE_SIZE], [0.5, 0.5], noteStackArt);

// ---------------------------------------------------------------- lookup

export function getAsset(key: string): RegistryEntry | undefined {
  return REGISTRY.get(key);
}

export function allAssets(): readonly RegistryEntry[] {
  return [...REGISTRY.values()];
}

const urlCache = new Map<string, string>();

/** Data URL of an asset's placeholder (for Angular <img> use). */
export function placeholderUrl(key: string): string {
  let url = urlCache.get(key);
  if (!url) {
    const out = REGISTRY.get(key)?.placeholder?.();
    url = typeof out === 'string' ? out : (out?.toDataURL() ?? '');
    urlCache.set(key, url);
  }
  return url;
}
