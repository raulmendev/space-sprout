import type { Actor } from '../types/domain';
import { CATALOG } from './catalog';

/**
 * The station store: where seeds go to be spent. Seed packets, fertilizer and post-its go
 * into one shared household inventory; planting, fertilizing and pinning a note use them up.
 * Decorations are incentives to save toward; they get placed in the station (see decor.ts).
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
/** An empty pot: potting a grown plant uses one (see potting.ts). */
export const CLAY_POT = 'clay-pot';
/** A sign that names a plant: naming one uses it (see labels.ts). */
export const PLANT_LABEL = 'plant-label';
export const seedItemId = (plant: string) => `seed:${plant}`;

const PLANTS = CATALOG.filter((p) => p.type === 'PLANT');

// One packet plants one plant, at the price planting used to cost.
const seedPacket = (p: (typeof CATALOG)[number]): StoreItem => ({
  id: seedItemId(p.id),
  section: 'GARDEN',
  name: `${p.name} seeds`,
  description: p.description,
  price: p.price,
  plant: p.id,
});

/** What the store sells. */
export const STORE_ITEMS: readonly StoreItem[] = [
  ...PLANTS.filter((p) => !p.retired).map(seedPacket),
  { id: FERTILIZER, section: 'GARDEN', name: 'Fertilizer', description: 'One scoop helps a growing plant along.', price: 2, icon: '🧪' },
  { id: CLAY_POT, section: 'GARDEN', name: 'Clay pot', description: 'Pot a grown plant and bring it indoors.', price: 4, icon: '🏺' },
  { id: PLANT_LABEL, section: 'GARDEN', name: 'Plant label', description: 'Name a plant after someone or something special.', price: 3, icon: '🏷️' },
  { id: POST_IT, section: 'MESSAGES', name: 'Post-it', description: 'One note for the message board, home and back.', price: 3, icon: '📝' },
  { id: 'photo-frame', section: 'DECORATIONS', name: 'Photo frame', description: 'For a favourite picture from home.', price: 12, icon: '🖼️' },
  { id: 'earth-poster', section: 'DECORATIONS', name: 'Earth poster', description: 'The view from the window, to keep.', price: 10, icon: '🌍' },
  { id: 'fairy-lights', section: 'DECORATIONS', name: 'Fairy lights', description: 'A warm glow for long station nights.', price: 15, icon: '✨' },
  { id: 'cozy-rug', section: 'DECORATIONS', name: 'Cozy rug', description: 'Soft underfoot, even in orbit.', price: 18, icon: '🧶' },
  { id: 'star-lamp', section: 'DECORATIONS', name: 'Star lamp', description: 'Paints constellations on the ceiling.', price: 20, icon: '🌟' },
  { id: 'terrarium', section: 'DECORATIONS', name: 'Terrarium', description: 'A tiny garden under glass.', price: 14, icon: '🪴' },
  { id: 'holo-globe', section: 'DECORATIONS', name: 'Holo globe', description: 'Home, spinning in light.', price: 22, icon: '🌐' },
  { id: 'keepsake-shelf', section: 'DECORATIONS', name: 'Keepsake shelf', description: 'Books, a plant and little treasures.', price: 16, icon: '📚' },
  { id: 'memory-board', section: 'DECORATIONS', name: 'Memory board', description: 'Pin up photos and happy days.', price: 12, icon: '📌' },
  { id: 'galaxy-lamp', section: 'DECORATIONS', name: 'Galaxy lamp', description: 'Slow swirls of starry light.', price: 18, icon: '🫧' },
];

/** Everything the store has ever sold: also packets of retired plants, which households may still own. */
export const ALL_STORE_ITEMS: readonly StoreItem[] = [...STORE_ITEMS, ...PLANTS.filter((p) => p.retired).map(seedPacket)];

export const STORE_SECTIONS: readonly { id: StoreSection; title: string; icon: string }[] = [
  { id: 'GARDEN', title: 'Gardening', icon: '🌱' },
  { id: 'MESSAGES', title: 'Messages', icon: '📝' },
  { id: 'DECORATIONS', title: 'Decorations', icon: '🖼️' },
];

/** What a new household starts with, so the garden, labels and the message board can be tried before the first check-in. */
export const STARTER_INVENTORY: Inventory = { [seedItemId('lettuce')]: 2, [FERTILIZER]: 1, [POST_IT]: 1, [PLANT_LABEL]: 1 };

/** Recent purchases kept (and shown in the store). */
export const PURCHASE_LOG_SIZE = 3;

export type PurchaseError = 'UNKNOWN_ITEM' | 'INSUFFICIENT_FUNDS';

/** Any item the store has ever sold, so owned items and old purchases keep their names. */
export function getStoreItem(id: string): StoreItem | undefined {
  return ALL_STORE_ITEMS.find((i) => i.id === id);
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
  // Only what's on sale now: retired packets can't be bought.
  const item = STORE_ITEMS.find((i) => i.id === itemId);
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
