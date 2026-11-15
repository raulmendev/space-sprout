import type { CareAction } from '@garden/shared';

/** What a care action is called once done: "Watered", "Pruned"… */
export const CARE_PAST: Record<CareAction, string> = { WATER: 'Watered', FERTILIZE: 'Fertilized', PRUNE: 'Pruned', HARVEST: 'Harvested' };
