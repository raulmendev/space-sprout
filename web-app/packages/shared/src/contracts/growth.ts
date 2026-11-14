import type { GardenObject, PlantStage } from '../types/domain';
import { getCatalogItem, matureAfterMs } from './catalog';

type Growable = Pick<GardenObject, 'itemType' | 'createdAt' | 'care'>;

/** Time the plant counts as having grown: real age plus whatever care has added. */
export function growthAgeMs(obj: Growable, now: number): number {
  return now - Date.parse(obj.createdAt) + (obj.care?.boostMs ?? 0);
}

/** Deterministic, timestamp-based growth. No background jobs, no decay; care only moves it forward. */
export function getPlantStage(obj: Growable, now: number): PlantStage {
  const stages = getCatalogItem(obj.itemType)?.growth?.stages;
  if (!stages?.length) return 'MATURE';
  const age = growthAgeMs(obj, now);
  let stage = stages[0][0];
  for (const [s, startsAt] of stages) if (age >= startsAt) stage = s;
  return stage;
}

/** Ms until the plant reaches maturity (0 if already mature). */
export function msUntilMature(obj: Growable, now: number): number {
  const total = matureAfterMs(getCatalogItem(obj.itemType));
  return total ? Math.max(0, total - growthAgeMs(obj, now)) : 0;
}
