import type { Actor } from '../types/domain';
import { CATALOG } from './catalog';

/**
 * The station store: where seeds go to be spent. Seed packets, fertilizer and post-its go
 * into one shared household inventory; planting, fertilizing and pinning a note use them up.
 * Decorations are incentives to save toward (owned for now; placing them comes later).
 */
export type StoreSection = 'GARDEN' | 'MESSAGES' | 'DECORATIONS';

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
/** One note on the message board. */
export const POST_IT = 'post-it';
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
  { id: POST_IT, section: 'MESSAGES', name: 'Post-it', description: 'One note for the message board, home and back.', price: 3, icon: '📝' },
  { id: 'photo-frame', section: 'DECORATIONS', name: 'Photo frame', description: 'For a favourite picture from home.', price: 12, icon: '🖼️' },
  { id: 'earth-poster', section: 'DECORATIONS', name: 'Earth poster', description: 'The view from the window, to keep.', price: 10, icon: '🌍' },
  { id: 'fairy-lights', section: 'DECORATIONS', name: 'Fairy lights', description: 'A warm glow for long station nights.', price: 15, icon: '✨' },
  { id: 'cozy-rug', section: 'DECORATIONS', name: 'Cozy rug', description: 'Soft underfoot, even in orbit.', price: 18, icon: '🧶' },
  { id: 'star-lamp', section: 'DECORATIONS', name: 'Star lamp', description: 'Paints constellations on the ceiling.', price: 20, icon: '🌟' },
];

export const STORE_SECTIONS: readonly { id: StoreSection; title: string; icon: string }[] = [
  { id: 'GARDEN', title: 'Gardening', icon: '🌱' },
  { id: 'MESSAGES', title: 'Messages', icon: '📝' },
  { id: 'DECORATIONS', title: 'Decorations', icon: '🖼️' },
];

/** What a new household starts with, so the garden and the message board can be tried before the first check-in. */
export const STARTER_INVENTORY: Inventory = { [seedItemId('flower')]: 2, [FERTILIZER]: 1, [POST_IT]: 1 };

/** Recent purchases kept (and shown in the store). */
export const PURCHASE_LOG_SIZE = 3;

export type PurchaseError = 'UNKNOWN_ITEM' | 'INSUFFICIENT_FUNDS';

export function getStoreItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => i.id === id);
}

export const owned = (inventory: Inventory, itemId: string): number => inventory[itemId] ?? 0;

/** What a purchase reads and changes. */
export interface StoreState {
  balance: number;
  inventory: Inventory;
  purchases: Purchase[];
}

/**
 * Pure purchase rule: check it, then return the state after it (the server will run the same one).
 * Charges the price, adds one to the inventory and records who bought it.
 */
export function applyPurchase(
  state: StoreState,
  itemId: string,
  actor: Actor,
  at: string,
): { ok: true; state: StoreState } | { ok: false; error: PurchaseError } {
  const item = getStoreItem(itemId);
  if (!item) return { ok: false, error: 'UNKNOWN_ITEM' };
  if (state.balance < item.price) return { ok: false, error: 'INSUFFICIENT_FUNDS' };
  return {
    ok: true,
    state: {
      balance: state.balance - item.price,
      inventory: { ...state.inventory, [itemId]: owned(state.inventory, itemId) + 1 },
      purchases: [{ itemId, by: actor.id, byName: actor.name, at }, ...state.purchases].slice(0, PURCHASE_LOG_SIZE),
    },
  };
}

/** The inventory with one `itemId` used up (planting a packet, fertilizing). */
export function consume(inventory: Inventory, itemId: string): Inventory {
  return { ...inventory, [itemId]: Math.max(0, owned(inventory, itemId) - 1) };
}
