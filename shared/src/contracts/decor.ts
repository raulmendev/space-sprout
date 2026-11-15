import type { Actor } from '../types/domain';
import { TileCoord, TileRect, anchorsCovering, footprintTiles, rectContains } from './geometry';
import { ROOM_COLS, ROOM_IDS, ROOM_ROWS, RoomId, TileKind, getTileKind, propAtTile } from './habitat';
import { pottedPlantOf } from './potting';
import { Inventory, owned } from './store';

/**
 * Things placed in the station: decorations bought at the store, and potted plants (potting.ts).
 * Placing one takes it out of the shared inventory, putting it away gives it back. Anyone in the
 * household can place, move or put away any of them (one shared station).
 *
 * They're looks only: characters walk over and past them.
 */

/** Hung on the back wall, or stood on the floor. */
export type DecorMount = 'WALL' | 'FLOOR';

export interface DecorSpec {
  mount: DecorMount;
  /** Footprint in tiles, from the top-left tile. */
  w: number;
  h: number;
  /** Lies flat on the floor (a rug): drawn under characters and other decorations. */
  flat?: boolean;
  /** Rooms it can go in. Default: DECOR_ROOMS. */
  rooms?: readonly RoomId[];
  /** Can be watered (potted plants): it shines until it's thirsty again. */
  waterable?: boolean;
}

/** How each decoration store item is placed. Adding a decoration = a store item + one row here. */
export const DECOR_SPECS: Readonly<Record<string, DecorSpec>> = {
  'photo-frame': { mount: 'WALL', w: 1, h: 1 },
  'earth-poster': { mount: 'WALL', w: 1, h: 1 },
  'fairy-lights': { mount: 'WALL', w: 2, h: 1 },
  'cozy-rug': { mount: 'FLOOR', w: 2, h: 2, flat: true },
  'star-lamp': { mount: 'FLOOR', w: 1, h: 1 },
  terrarium: { mount: 'FLOOR', w: 1, h: 1 },
  'holo-globe': { mount: 'FLOOR', w: 1, h: 1 },
  'keepsake-shelf': { mount: 'WALL', w: 1, h: 1 },
  'memory-board': { mount: 'WALL', w: 2, h: 1 },
  'galaxy-lamp': { mount: 'FLOOR', w: 1, h: 1 },
};

/** Rooms decorations can go in. The Social Space for now. */
export const DECOR_ROOMS: readonly RoomId[] = ['SOCIAL'];

/** Potted plants: one tile of floor, in any room. */
const POT_SPEC: DecorSpec = { mount: 'FLOOR', w: 1, h: 1, rooms: ROOM_IDS, waterable: true };

/** How `itemId` is placed: a decoration's spec, or the pot spec for potted plants. */
export function decorSpec(itemId: string): DecorSpec | undefined {
  return DECOR_SPECS[itemId] ?? (pottedPlantOf(itemId) ? POT_SPEC : undefined);
}

/** Can `itemId` be placed in `room` at all? */
export const canPlaceIn = (itemId: string, room: RoomId): boolean => (decorSpec(itemId)?.rooms ?? DECOR_ROOMS).includes(room);

/** Tiles each mount can go on. */
const SURFACES: Record<DecorMount, ReadonlySet<TileKind>> = {
  WALL: new Set<TileKind>(['WALL_FACE']),
  // Any floor, and the Garden's paths and grass (not its soil: that's for planting).
  FLOOR: new Set<TileKind>(['FLOOR_SOCIAL', 'RUG', 'FLOOR_MEDICAL', 'PATH_STONE', 'PATH_WOOD', 'GRASS', 'GRASS_FLOWERS']),
};

export interface PlacedDecor {
  id: string;
  /** Store item id, e.g. 'photo-frame'. */
  itemId: string;
  room: RoomId;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  placedAt: string;
  placedBy: string;
  placedByName: string;
  /** Waterable things (potted plants): when it was last watered, and by whom (for its shine). */
  care?: { lastWateredAt: string; by: string; byName: string };
}

export type DecorError =
  | 'NOT_DECOR'
  | 'WRONG_ROOM'
  | 'OUT_OF_BOUNDS'
  /** Wall things need the wall, floor things the floor. */
  | 'WRONG_SURFACE'
  /** A station or another decoration is there. */
  | 'TILE_OCCUPIED'
  /** None of it left in the household inventory. */
  | 'NONE_OWNED'
  /** Only some things (potted plants) can be watered. */
  | 'NOT_WATERABLE'
  | 'NOT_FOUND';

export const isDecor = (itemId: string): boolean => !!decorSpec(itemId);

export function decorRect(d: Pick<PlacedDecor, 'itemId' | 'x' | 'y'>): TileRect {
  const spec = decorSpec(d.itemId);
  return { x: d.x, y: d.y, w: spec?.w ?? 1, h: spec?.h ?? 1 };
}

/** The decoration covering tile (x, y) in `room`, if any (the top one when a rug lies underneath). */
export function decorAt(placed: readonly PlacedDecor[], room: RoomId, x: number, y: number): PlacedDecor | undefined {
  const here = placed.filter((d) => d.room === room && rectContains(decorRect(d), x, y));
  return here.find((d) => !decorSpec(d.itemId)?.flat) ?? here[0];
}

/**
 * Can `itemId` go with its top-left at (x, y)? Spatial rules only (ownership is checked on placing).
 * `ignoreId`: a decoration being moved doesn't block its own new spot.
 */
export function decorSpotError(
  itemId: string,
  room: RoomId,
  x: number,
  y: number,
  placed: readonly PlacedDecor[],
  ignoreId?: string,
): DecorError | null {
  const spec = decorSpec(itemId);
  if (!spec) return 'NOT_DECOR';
  if (!canPlaceIn(itemId, room)) return 'WRONG_ROOM';
  // Flat things (rugs) only clash with other flat things; a lamp can stand on a rug.
  const others = placed.filter((d) => d.id !== ignoreId && d.room === room && !!decorSpec(d.itemId)?.flat === !!spec.flat);
  for (const t of footprintTiles({ x, y, w: spec.w, h: spec.h })) {
    const kind = getTileKind(room, t.x, t.y);
    if (!kind) return 'OUT_OF_BOUNDS';
    if (!SURFACES[spec.mount].has(kind)) return 'WRONG_SURFACE';
    if (propAtTile(room, t.x, t.y)) return 'TILE_OCCUPIED';
    if (others.some((d) => rectContains(decorRect(d), t.x, t.y))) return 'TILE_OCCUPIED';
  }
  return null;
}

/** Every top-left tile where `itemId` fits in `room` right now. */
export function decorSpots(itemId: string, room: RoomId, placed: readonly PlacedDecor[], ignoreId?: string): TileCoord[] {
  const spots: TileCoord[] = [];
  for (let y = 0; y < ROOM_ROWS; y++) {
    for (let x = 0; x < ROOM_COLS; x++) {
      if (!decorSpotError(itemId, room, x, y, placed, ignoreId)) spots.push({ x, y });
    }
  }
  return spots;
}

/** The top-left that puts `itemId` over the tapped tile, if any (same preference order as planting). */
export function decorAnchorFor(
  itemId: string,
  room: RoomId,
  tile: TileCoord,
  placed: readonly PlacedDecor[],
  ignoreId?: string,
): TileCoord | null {
  const spec = decorSpec(itemId);
  if (!spec) return null;
  for (const at of anchorsCovering(tile, spec.w, spec.h)) {
    if (!decorSpotError(itemId, room, at.x, at.y, placed, ignoreId)) return at;
  }
  return null;
}

/** What placing, moving and putting away read and change. */
export interface DecorState {
  inventory: Inventory;
  decorations: PlacedDecor[];
}

/** The outcome of placing, moving or putting away: the new state, or why not. */
export type DecorChange = { ok: true; state: DecorState; decor: PlacedDecor } | { ok: false; error: DecorError };

/** Take one `itemId` out of the inventory and put it at (x, y). Pure; the server will run the same rule. */
export function placeDecor(
  state: DecorState,
  itemId: string,
  room: RoomId,
  x: number,
  y: number,
  actor: Actor,
  at: string,
  id: string,
): DecorChange {
  if (!isDecor(itemId)) return { ok: false, error: 'NOT_DECOR' };
  if (owned(state.inventory, itemId) < 1) return { ok: false, error: 'NONE_OWNED' };
  const error = decorSpotError(itemId, room, x, y, state.decorations);
  if (error) return { ok: false, error };
  const decor: PlacedDecor = { id, itemId, room, x, y, placedAt: at, placedBy: actor.id, placedByName: actor.name };
  return {
    ok: true,
    decor,
    state: {
      inventory: { ...state.inventory, [itemId]: owned(state.inventory, itemId) - 1 },
      decorations: [...state.decorations, decor],
    },
  };
}

/** Move a placed decoration to a new top-left in the same room. */
export function moveDecor(state: DecorState, decorId: string, x: number, y: number): DecorChange {
  return updateDecor(state, decorId, (d) => decorSpotError(d.itemId, d.room, x, y, state.decorations, decorId) ?? { ...d, x, y });
}

/** Water a potted plant: it shines until it's thirsty again. Never needed; nothing wilts. */
export function waterDecor(state: DecorState, decorId: string, actor: Actor, at: string): DecorChange {
  return updateDecor(state, decorId, (d) =>
    decorSpec(d.itemId)?.waterable ? { ...d, care: { lastWateredAt: at, by: actor.id, byName: actor.name } } : 'NOT_WATERABLE',
  );
}

/** Change one placed decoration: `change` returns the new version, or why not. */
function updateDecor(state: DecorState, decorId: string, change: (d: PlacedDecor) => PlacedDecor | DecorError): DecorChange {
  const current = state.decorations.find((d) => d.id === decorId);
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  const decor = change(current);
  if (typeof decor === 'string') return { ok: false, error: decor };
  return { ok: true, decor, state: { ...state, decorations: state.decorations.map((d) => (d.id === decorId ? decor : d)) } };
}

/** Take a placed decoration down and give it back to the inventory. */
export function putAwayDecor(state: DecorState, decorId: string): DecorChange {
  const decor = state.decorations.find((d) => d.id === decorId);
  if (!decor) return { ok: false, error: 'NOT_FOUND' };
  return {
    ok: true,
    decor,
    state: {
      inventory: { ...state.inventory, [decor.itemId]: owned(state.inventory, decor.itemId) + 1 },
      decorations: state.decorations.filter((d) => d.id !== decorId),
    },
  };
}
