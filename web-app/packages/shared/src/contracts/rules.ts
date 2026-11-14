import type { GardenObject } from '../types/domain';
import { footprintOf, getCatalogItem } from './catalog';
import { TileRect, footprintTiles, rectContains } from './geometry';
import { getTileKind, isNpcTile, propAtTile } from './habitat';

export type PlacementError =
  | 'UNKNOWN_ITEM'
  | 'OUT_OF_BOUNDS'
  | 'NOT_PLANTABLE'
  | 'TILE_OCCUPIED'
  | 'INSUFFICIENT_FUNDS';

export type Placed = Pick<GardenObject, 'x' | 'y' | 'itemType'>;

/** Tiles a placed object covers. */
export function objectRect(o: Placed): TileRect {
  return { x: o.x, y: o.y, ...footprintOf(o.itemType) };
}

/** Object whose footprint covers tile (x, y), if any. */
export function objectAtTile<T extends Placed>(objects: readonly T[], x: number, y: number): T | undefined {
  return objects.find((o) => rectContains(objectRect(o), x, y));
}

/** Something already stands here: a prop, the NPC, or a placed object. */
export function isBlocked(x: number, y: number, objects: readonly Placed[]): boolean {
  return !!propAtTile(x, y) || isNpcTile(x, y) || !!objectAtTile(objects, x, y);
}

function spatialError(itemType: string, x: number, y: number, objects: readonly Placed[]): PlacementError | null {
  const item = getCatalogItem(itemType);
  if (!item) return 'UNKNOWN_ITEM';
  for (const t of footprintTiles({ x, y, ...footprintOf(itemType) })) {
    const kind = getTileKind(t.x, t.y);
    if (!kind) return 'OUT_OF_BOUNDS';
    if (item.type === 'PLANT' && kind !== 'SOIL') return 'NOT_PLANTABLE';
    if (item.type === 'DECORATION' && kind !== 'GRASS' && kind !== 'GRASS_FLOWERS') return 'NOT_PLANTABLE';
    if (isBlocked(t.x, t.y, objects)) return 'TILE_OCCUPIED';
  }
  return null;
}

/**
 * Pure placement rule, with (x, y) as the footprint's top-left tile. Used for
 * client feedback now and for authoritative server validation later.
 */
export function validatePlacement(
  itemType: string,
  x: number,
  y: number,
  objects: readonly Placed[],
  balance: number,
): PlacementError | null {
  const err = spatialError(itemType, x, y, objects);
  if (err) return err;
  return balance < getCatalogItem(itemType)!.price ? 'INSUFFICIENT_FUNDS' : null;
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
  balance: number,
): { ok: true; x: number; y: number } | { ok: false; error: PlacementError } {
  const f = footprintOf(itemType);
  let firstError: PlacementError | null = null;
  for (let dy = 0; dy < f.h; dy++) {
    for (let dx = 0; dx < f.w; dx++) {
      const err = spatialError(itemType, x - dx, y - dy, objects);
      if (!err) {
        return balance < getCatalogItem(itemType)!.price
          ? { ok: false, error: 'INSUFFICIENT_FUNDS' }
          : { ok: true, x: x - dx, y: y - dy };
      }
      firstError ??= err;
    }
  }
  return { ok: false, error: firstError ?? 'NOT_PLANTABLE' };
}
