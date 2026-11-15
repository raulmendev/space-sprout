import type { Footprint, GardenObjectType, PlantStage } from '../types/domain';

export interface CatalogItem {
  id: string;
  type: GardenObjectType;
  name: string;
  description: string;
  price: number;
  /** Display names per growth stage, where they differ from Seed/Sprout/Grown. */
  stageLabels?: Partial<Record<PlantStage, string>>;
  /** Tiles occupied, from the top-left placement tile. Defaults to 1x1. */
  footprint?: Footprint;
  /**
   * Plants only: the species' stages in growth order, each with the ms after planting at which it
   * begins. The first starts at 0 and the last is MATURE. Most plants: SEED → SPROUT → MATURE.
   */
  growth?: { stages: readonly (readonly [PlantStage, number])[] };
}

const SEC = 1000;
const MIN = 60 * SEC;

/**
 * Growth durations are deliberately short so changes are visible during a demo.
 * Plants never wilt or die.
 */
export const CATALOG: readonly CatalogItem[] = [
  {
    id: 'flower',
    type: 'PLANT',
    name: 'Wildflower',
    description: 'A cheerful pink bloom. Grows quickly.',
    price: 5,
    growth: { stages: [['SEED', 0], ['SPROUT', 20 * SEC], ['MATURE', 1 * MIN]] },
  },
  {
    id: 'sunflower',
    type: 'PLANT',
    name: 'Sunflower',
    description: 'Tall and bright. Always faces home.',
    price: 8,
    growth: { stages: [['SEED', 0], ['SPROUT', 40 * SEC], ['MATURE', 2 * MIN]] },
  },
  {
    id: 'tree',
    type: 'PLANT',
    name: 'Small tree',
    description: 'Takes its time, then gives shade and apples.',
    price: 15,
    footprint: { w: 2, h: 2 },
    stageLabels: { SPROUT: 'Sapling' },
    growth: { stages: [['SEED', 0], ['SPROUT', 1 * MIN], ['MATURE', 4 * MIN]] },
  },
  {
    id: 'mustard',
    type: 'PLANT',
    name: 'Mustard',
    description: 'Leafy and quick, then a burst of little yellow flowers.',
    price: 6,
    // Planted as a sprout: mustard has no seed stage.
    stageLabels: { MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 30 * SEC], ['BUD', 1 * MIN], ['MATURE', 90 * SEC]] },
  },
  {
    id: 'lettuce',
    type: 'PLANT',
    name: 'Lettuce',
    description: 'Crisp leaves first; left alone, it bolts into little flowers.',
    price: 4,
    stageLabels: { GROWING: 'Head', MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 20 * SEC], ['BUD', 45 * SEC], ['MATURE', 70 * SEC]] },
  },
  {
    id: 'fern',
    type: 'PLANT',
    name: 'Fern',
    description: 'Starts as a curled fiddlehead and unrolls into a lush crown.',
    price: 5,
    stageLabels: { SPROUT: 'Fiddlehead', BUD: 'Unfurling', MATURE: 'Lush' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 25 * SEC], ['BUD', 1 * MIN], ['MATURE', 100 * SEC]] },
  },
  {
    id: 'nopal',
    type: 'PLANT',
    name: 'Nopal',
    description: 'A tough cactus that adds a pad at a time, then pink flowers.',
    price: 6,
    stageLabels: { BUD: 'Adult', MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 40 * SEC], ['BUD', 90 * SEC], ['MATURE', 2 * MIN]] },
  },
  {
    id: 'lily',
    type: 'PLANT',
    name: 'Lily of the valley',
    description: 'Broad leaves, then a curved stem of tiny white bells.',
    price: 7,
    stageLabels: { MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 30 * SEC], ['BUD', 70 * SEC], ['MATURE', 2 * MIN]] },
  },
  {
    id: 'rose',
    type: 'PLANT',
    name: 'Rose bush',
    description: 'Slow to bud, worth the wait: deep red roses.',
    price: 10,
    stageLabels: { MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 40 * SEC], ['BUD', 90 * SEC], ['MATURE', 150 * SEC]] },
  },
  {
    id: 'pitcher',
    type: 'PLANT',
    name: 'Pitcher plant',
    description: 'A curious carnivore that grows red pitchers on its leaf tips.',
    price: 12,
    stageLabels: { BUD: 'First pitcher', MATURE: 'Full pitchers' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 45 * SEC], ['BUD', 100 * SEC], ['MATURE', 3 * MIN]] },
  },
  {
    id: 'cempasuchil',
    type: 'PLANT',
    name: 'Cempasúchil',
    description: 'A leafy marigold that opens into big orange pompom flowers.',
    price: 9,
    // The art has eight stages; the game shows four of them (01, 03, 04, 07).
    stageLabels: { GROWING: 'Leafy', MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 35 * SEC], ['BUD', 80 * SEC], ['MATURE', 2 * MIN]] },
  },
  {
    id: 'monstera',
    type: 'PLANT',
    name: 'Monstera',
    description: 'Heart leaves that split as they grow, crowned by a cream flower.',
    price: 11,
    stageLabels: { BUD: 'Adult', MATURE: 'Flowering' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 45 * SEC], ['BUD', 100 * SEC], ['MATURE', 160 * SEC]] },
  },
  {
    id: 'tulip',
    type: 'PLANT',
    name: 'Orange tulip',
    description: 'Two broad leaves, then a single bright orange cup.',
    price: 8,
    stageLabels: { MATURE: 'Blooming' },
    growth: { stages: [['SPROUT', 0], ['GROWING', 30 * SEC], ['BUD', 75 * SEC], ['MATURE', 2 * MIN]] },
  },
  {
    id: 'yellowflower',
    type: 'PLANT',
    name: 'Yellow flowers',
    description: 'A bright clump of yellow blossoms, already in full bloom.',
    price: 7,
    // Only the blooming art exists, so it arrives fully grown.
    stageLabels: { MATURE: 'Blooming' },
    growth: { stages: [['MATURE', 0]] },
  },
];

/** The stages this item goes through, in order (non-growing items are always MATURE). */
export function plantStages(item: CatalogItem | undefined): PlantStage[] {
  return item?.growth ? item.growth.stages.map(([stage]) => stage) : ['MATURE'];
}

/** Ms of growth after which this item is fully grown (0 if it doesn't grow). */
export function matureAfterMs(item: CatalogItem | undefined): number {
  return item?.growth?.stages.at(-1)?.[1] ?? 0;
}

export function footprintOf(itemType: string): Footprint {
  return getCatalogItem(itemType)?.footprint ?? { w: 1, h: 1 };
}

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}
