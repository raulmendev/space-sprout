/** Grid geometry shared by rules, movement and rendering. Rects are half-open, in tiles. */
export interface TileCoord {
  x: number;
  y: number;
}

export interface TileRect extends TileCoord {
  w: number;
  h: number;
}

export function rectContains(r: TileRect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Every tile a rect covers. */
export function* footprintTiles(r: TileRect): Generator<TileCoord> {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) yield { x, y };
}

/** Tiles between a point and a rect (0 when inside), counting diagonals as 1. */
export function chebyshev(t: TileCoord, r: TileRect): number {
  const dx = Math.max(r.x - t.x, 0, t.x - (r.x + r.w - 1));
  const dy = Math.max(r.y - t.y, 0, t.y - (r.y + r.h - 1));
  return Math.max(dx, dy);
}

/** Distance from a continuous point (tile units) to the nearest edge of a rect; 0 inside it. */
export function distanceToRect(p: { x: number; y: number }, r: TileRect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
