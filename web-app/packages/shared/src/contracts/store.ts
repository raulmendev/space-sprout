import { CATALOG } from './catalog';

/**
 * The station store: where seeds go to be spent. Seed packets and fertilizer go
 * into one shared household inventory; planting and fertilizing use them up.
 * Decorations are incentives to save toward (owned for now; placing them comes later).
 */
export type StoreSection = 'GARDEN' | 'DECORATIONS';

export interface StoreItem {
  id: string;
  section: StoreSection;
  name: string;
  description: string;
  price: number;
  /** Seed packets: the plant (catalog id) they grow. */
  plant?: string;
  /** Placeholder icon until the design team's art arrives (seed packets show the plant instead). */
  icon?: string;
}

/** Household inventory: store item id → how many are owned. */
export type Inventory = Record<string, number>;

/** Who bought what, so the shared household can see it. */
export interface Purchase {
  itemId: string;
  by: string;
  byName: string;
  at: string;
}

export const FERTILIZER = 'fertilizer';
export const seedItemId = (plant: string) => `seed:${plant}`;

export const STORE_ITEMS: readonly StoreItem[] = [
  // One packet plants one plant, at the price planting used to cost.
  ...CATALOG.filter((p) => p.type === 'PLANT').map((p) => ({
    id: seedItemId(p.id),
    section: 'GARDEN' as const,
    name: `${p.name} seeds`,
    description: p.description,
    price: p.price,
    plant: p.id,
  })),
  { id: FERTILIZER, section: 'GARDEN', name: 'Fertilizer', description: 'One scoop helps a growing plant along.', price: 2, icon: '🧪' },
  { id: 'photo-frame', section: 'DECORATIONS', name: 'Photo frame', description: 'For a favourite picture from home.', price: 12, icon: '🖼️' },
  { id: 'earth-poster', section: 'DECORATIONS', name: 'Earth poster', description: 'The view from the window, to keep.', price: 10, icon: '🌍' },
  { id: 'fairy-lights', section: 'DECORATIONS', name: 'Fairy lights', description: 'A warm glow for long station nights.', price: 15, icon: '✨' },
  { id: 'cozy-rug', section: 'DECORATIONS', name: 'Cozy rug', description: 'Soft underfoot, even in orbit.', price: 18, icon: '🧶' },
  { id: 'star-lamp', section: 'DECORATIONS', name: 'Star lamp', description: 'Paints constellations on the ceiling.', price: 20, icon: '🌟' },
];

export const STORE_SECTIONS: readonly { id: StoreSection; title: string; icon: string }[] = [
  { id: 'GARDEN', title: 'Garden', icon: '🌱' },
  { id: 'DECORATIONS', title: 'Decorations', icon: '🖼️' },
];

/** What a new household starts with, so the garden can be tried before the first check-in. */
export const STARTER_INVENTORY: Inventory = { [seedItemId('flower')]: 2, [FERTILIZER]: 1 };

/** Kept in the purchase history. */
export const PURCHASE_LOG_SIZE = 8;

export type PurchaseError = 'UNKNOWN_ITEM' | 'INSUFFICIENT_FUNDS';

export function getStoreItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => i.id === id);
}

export const owned = (inventory: Inventory, itemId: string): number => inventory[itemId] ?? 0;

/** Pure purchase rule (the server will run the same one). */
export function checkPurchase(itemId: string, balance: number): PurchaseError | null {
  const item = getStoreItem(itemId);
  if (!item) return 'UNKNOWN_ITEM';
  return balance < item.price ? 'INSUFFICIENT_FUNDS' : null;
}
