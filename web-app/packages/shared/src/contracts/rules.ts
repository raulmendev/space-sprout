import type { GardenObject } from '../types/domain';
import { footprintOf, getCatalogItem } from './catalog';
import { TileRect, anchorsCovering, footprintTiles, rectContains } from './geometry';
import { GARDEN_ROOM, RoomId, getTileKind, propAtTile } from './habitat';

export type PlacementError =
  | 'UNKNOWN_ITEM'
  | 'OUT_OF_BOUNDS'
  | 'NOT_PLANTABLE'
  | 'TILE_OCCUPIED'
  /** No packet of this seed in the household inventory (buy one at the store). */
  | 'NO_SEEDS';

export type Placed = Pick<GardenObject, 'x' | 'y' | 'itemType'>;

/** Tiles a placed object covers. */
export function objectRect(o: Placed): TileRect {
  return { x: o.x, y: o.y, ...footprintOf(o.itemType) };
}

/** Object whose footprint covers tile (x, y), if any. */
export function objectAtTile<T extends Placed>(objects: readonly T[], x: number, y: number): T | undefined {
  return objects.find((o) => rectContains(objectRect(o), x, y));
}

/** Something already stands here: a prop or a placed object (garden objects live in the garden room). Characters never block. */
export function isBlocked(room: RoomId, x: number, y: number, objects: readonly Placed[]): boolean {
  if (propAtTile(room, x, y)) return true;
  return room === GARDEN_ROOM && !!objectAtTile(objects, x, y);
}

function spatialError(itemType: string, x: number, y: number, objects: readonly Placed[]): PlacementError | null {
  const item = getCatalogItem(itemType);
  if (!item) return 'UNKNOWN_ITEM';
  for (const t of footprintTiles({ x, y, ...footprintOf(itemType) })) {
    const kind = getTileKind(GARDEN_ROOM, t.x, t.y);
    if (!kind) return 'OUT_OF_BOUNDS';
    if (item.type === 'PLANT' && kind !== 'SOIL') return 'NOT_PLANTABLE';
    if (item.type === 'DECORATION' && kind !== 'GRASS' && kind !== 'GRASS_FLOWERS') return 'NOT_PLANTABLE';
    if (isBlocked(GARDEN_ROOM, t.x, t.y, objects)) return 'TILE_OCCUPIED';
  }
  return null;
}

/**
 * Pure placement rule for the garden room, with (x, y) as the footprint's top-left tile. Used for
 * client feedback now and for authoritative server validation later.
 */
export function validatePlacement(
  itemType: string,
  x: number,
  y: number,
  objects: readonly Placed[],
  seedsOwned: number,
): PlacementError | null {
  return spatialError(itemType, x, y, objects) ?? (seedsOwned < 1 ? 'NO_SEEDS' : null);
}

/**
 * Find a top-left anchor so that the item's footprint covers the clicked tile.
 * Lets a 2x2 tree be planted by clicking any free plot it would fit around.
 */
export function findPlacement(
  itemType: string,
  x: number,
  y: number,
  objects: readonly Placed[],
  seedsOwned: number,
): { ok: true; x: number; y: number } | { ok: false; error: PlacementError } {
  const f = footprintOf(itemType);
  let firstError: PlacementError | null = null;
  for (const at of anchorsCovering({ x, y }, f.w, f.h)) {
    const err = spatialError(itemType, at.x, at.y, objects);
    if (!err) return seedsOwned < 1 ? { ok: false, error: 'NO_SEEDS' } : { ok: true, ...at };
    firstError ??= err;
  }
  return { ok: false, error: firstError ?? 'NOT_PLANTABLE' };
}
