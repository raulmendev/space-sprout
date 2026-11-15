import type { GardenObject } from '../types/domain';
import { type Inventory, PLANT_LABEL, consume, owned } from './store';

/**
 * Plant labels: a little sign by a plant that names it after something that matters ("Birth of
 * Johanna"). Labels are bought at the Supply Store; naming a plant that has no label yet uses one.
 * Renaming it is free, and anyone in the station can. Clearing the name takes the label off; it
 * isn't refunded. The label goes with the plant: harvesting or potting it takes the label away too.
 */
export const LABEL_RULES = {
  /** Longest name, in characters: one line on the sign. */
  maxLength: 24,
} as const;

export type LabelError = 'NOT_FOUND' | 'OUT_OF_LABELS';

/** The name as it goes on the sign: one line, spaces tidied, cut to the length limit. */
export function labelText(text: string): string {
  return [...text.replace(/\s+/g, ' ').trim()].slice(0, LABEL_RULES.maxLength).join('').trim();
}

/** What labelling reads and changes. */
export interface LabelState {
  objects: GardenObject[];
  inventory: Inventory;
}

/** Name a plant, rename it, or (with an empty name) take its label off. Pure. */
export function labelPlant(
  state: LabelState,
  plantId: string,
  text: string,
): { ok: true; state: LabelState } | { ok: false; error: LabelError } {
  const plant = state.objects.find((o) => o.id === plantId);
  if (!plant) return { ok: false, error: 'NOT_FOUND' };
  const label = labelText(text);
  const fresh = !!label && !plant.label;
  if (fresh && owned(state.inventory, PLANT_LABEL) < 1) return { ok: false, error: 'OUT_OF_LABELS' };
  const named: GardenObject = { ...plant, label };
  if (!label) delete named.label;
  return {
    ok: true,
    state: {
      objects: state.objects.map((o) => (o.id === plantId ? named : o)),
      inventory: fresh ? consume(state.inventory, PLANT_LABEL) : state.inventory,
    },
  };
}
