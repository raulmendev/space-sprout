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
