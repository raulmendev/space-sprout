import type { GardenObjectType } from '../types/domain';

export interface CatalogItem {
  id: string;
  type: GardenObjectType;
  name: string;
  description: string;
  price: number;
  /** Plants only: ms after planting at which each stage begins. */
  growth?: { sproutAfterMs: number; matureAfterMs: number };
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
    name: 'Flower',
    description: 'A cheerful pink bloom. Grows quickly.',
    price: 5,
    growth: { sproutAfterMs: 20 * SEC, matureAfterMs: 1 * MIN },
  },
  {
    id: 'sunflower',
    type: 'PLANT',
    name: 'Sunflower',
    description: 'Tall and bright. Always faces home.',
    price: 8,
    growth: { sproutAfterMs: 40 * SEC, matureAfterMs: 2 * MIN },
  },
  {
    id: 'tree',
    type: 'PLANT',
    name: 'Small tree',
    description: 'Takes its time, then gives shade and apples.',
    price: 15,
    growth: { sproutAfterMs: 1 * MIN, matureAfterMs: 4 * MIN },
  },
];

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}
