import type { GardenObject, PlantStage } from '../types/domain';
import { getCatalogItem } from './catalog';

/** Deterministic, timestamp-based growth. No background jobs, no decay. */
export function getPlantStage(obj: Pick<GardenObject, 'itemType' | 'createdAt'>, now: number): PlantStage {
  const growth = getCatalogItem(obj.itemType)?.growth;
  if (!growth) return 'MATURE';
  const age = now - Date.parse(obj.createdAt);
  if (age >= growth.matureAfterMs) return 'MATURE';
  if (age >= growth.sproutAfterMs) return 'SPROUT';
  return 'SEED';
}

/** Ms until the plant reaches maturity (0 if already mature). */
export function msUntilMature(obj: Pick<GardenObject, 'itemType' | 'createdAt'>, now: number): number {
  const growth = getCatalogItem(obj.itemType)?.growth;
  if (!growth) return 0;
  return Math.max(0, Date.parse(obj.createdAt) + growth.matureAfterMs - now);
}
