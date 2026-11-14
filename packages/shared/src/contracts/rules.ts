import type { GardenObject } from '../types/domain';
import { getCatalogItem } from './catalog';
import { getTileKind, NPC_TILE } from './layout';

export type PlacementError =
  | 'UNKNOWN_ITEM'
  | 'OUT_OF_BOUNDS'
  | 'NOT_PLANTABLE'
  | 'TILE_OCCUPIED'
  | 'INSUFFICIENT_FUNDS';

/**
 * Pure placement rule. Used for client-side feedback and (later) authoritative
 * validation on the server.
 */
export function validatePlacement(
  itemType: string,
  x: number,
  y: number,
  objects: readonly Pick<GardenObject, 'x' | 'y'>[],
  balance: number,
): PlacementError | null {
  const item = getCatalogItem(itemType);
  if (!item) return 'UNKNOWN_ITEM';
  const kind = getTileKind(x, y);
  if (!kind) return 'OUT_OF_BOUNDS';
  if (item.type === 'PLANT' && kind !== 'SOIL') return 'NOT_PLANTABLE';
  if (item.type === 'DECORATION' && kind !== 'GRASS' && kind !== 'GRASS_FLOWERS') return 'NOT_PLANTABLE';
  if (x === NPC_TILE.x && y === NPC_TILE.y) return 'TILE_OCCUPIED';
  if (objects.some((o) => o.x === x && o.y === y)) return 'TILE_OCCUPIED';
  if (balance < item.price) return 'INSUFFICIENT_FUNDS';
  return null;
}
