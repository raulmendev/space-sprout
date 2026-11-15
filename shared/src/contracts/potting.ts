import type { GardenObject } from '../types/domain';
import { CATALOG, plantName } from './catalog';
import { getPlantStage } from './growth';
import { ALL_STORE_ITEMS, CLAY_POT, Inventory, consume, getStoreItem, owned } from './store';

/**
 * Potting: a grown plant leaves its plot and goes into the shared inventory as a potted plant,
 * which can then be placed on any floor in the station (see decor.ts) and watered for its shine.
 * It uses one empty clay pot from the Supply Store. Harvesting is unchanged (+1 seed, plot freed).
 */

const POTTED_PREFIX = 'potted:';
/** Inventory item of a potted plant, e.g. 'potted:rose'. */
export const pottedItemId = (plant: string) => `${POTTED_PREFIX}${plant}`;
/** The plant (catalog id) in a potted item, or null for anything else. */
export const pottedPlantOf = (itemId: string): string | null =>
  itemId.startsWith(POTTED_PREFIX) ? itemId.slice(POTTED_PREFIX.length) : null;

export type PotError = 'NOT_FOUND' | 'NOT_MATURE' | 'NO_POT';

/** Can this plant be potted now? Only grown plants, and only with an empty pot in the inventory. */
export function checkPot(obj: GardenObject, now: number, potsOwned: number): PotError | null {
  if (getPlantStage(obj, now) !== 'MATURE') return 'NOT_MATURE';
  if (potsOwned < 1) return 'NO_POT';
  return null;
}

/** What potting reads and changes. */
export interface PotState {
  objects: GardenObject[];
  inventory: Inventory;
}

/** Pot a grown plant: it leaves the garden, a clay pot is used and the potted plant joins the inventory. Pure. */
export function potPlant(
  state: PotState,
  plantId: string,
  now: number,
): { ok: true; state: PotState; itemId: string } | { ok: false; error: PotError } {
  const obj = state.objects.find((o) => o.id === plantId);
  if (!obj) return { ok: false, error: 'NOT_FOUND' };
  const error = checkPot(obj, now, owned(state.inventory, CLAY_POT));
  if (error) return { ok: false, error };
  const itemId = pottedItemId(obj.itemType);
  return {
    ok: true,
    itemId,
    state: {
      objects: state.objects.filter((o) => o.id !== plantId),
      inventory: { ...consume(state.inventory, CLAY_POT), [itemId]: owned(state.inventory, itemId) + 1 },
    },
  };
}

/** Everything the household inventory can hold, in a stable order: store items, then a potted version of each plant. */
export const INVENTORY_ITEM_IDS: readonly string[] = [
  ...ALL_STORE_ITEMS.map((i) => i.id),
  ...CATALOG.filter((p) => p.type === 'PLANT').map((p) => pottedItemId(p.id)),
];

/** Name and icon of anything that can be in the inventory: store items and potted plants. */
export function describeItem(itemId: string): { name: string; icon?: string; plant?: string } {
  const plant = pottedPlantOf(itemId);
  if (plant) return { name: `Potted ${plantName(plant)}`, icon: '🪴', plant };
  const item = getStoreItem(itemId);
  return { name: item?.name ?? itemId, icon: item?.icon, plant: item?.plant };
}
