import { ROOM_COLS, ROOM_ROWS } from '@garden/shared';

/** Tile coordinate → percentage of the habitat, for DOM overlays laid over the canvas. */
export const colPct = (x: number) => (x / ROOM_COLS) * 100;
export const rowPct = (y: number) => (y / ROOM_ROWS) * 100;
