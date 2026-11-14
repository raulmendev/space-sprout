import { HABITAT_COLS, HABITAT_ROWS } from '@garden/shared';

/** Tile coordinate → percentage of the habitat, for DOM overlays laid over the canvas. */
export const colPct = (x: number) => (x / HABITAT_COLS) * 100;
export const rowPct = (y: number) => (y / HABITAT_ROWS) * 100;
