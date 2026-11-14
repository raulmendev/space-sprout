import type { GardenObject, PlantStage } from '../types/domain';
import { getCatalogItem } from './catalog';

type Growable = Pick<GardenObject, 'itemType' | 'createdAt' | 'care'>;

/** Time the plant counts as having grown: real age plus whatever care has added. */
export function growthAgeMs(obj: Growable, now: number): number {
  return now - Date.parse(obj.createdAt) + (obj.care?.boostMs ?? 0);
}

/** Deterministic, timestamp-based growth. No background jobs, no decay; care only moves it forward. */
export function getPlantStage(obj: Growable, now: number): PlantStage {
  const growth = getCatalogItem(obj.itemType)?.growth;
  if (!growth) return 'MATURE';
  const age = growthAgeMs(obj, now);
  if (age >= growth.matureAfterMs) return 'MATURE';
  if (age >= growth.sproutAfterMs) return 'SPROUT';
  return 'SEED';
}

/** Ms until the plant reaches maturity (0 if already mature). */
export function msUntilMature(obj: Growable, now: number): number {
  const growth = getCatalogItem(obj.itemType)?.growth;
  if (!growth) return 0;
  return Math.max(0, growth.matureAfterMs - growthAgeMs(obj, now));
}
