import { HABITAT_COLS, HABITAT_ROWS, TileKind, getTileKind } from './habitat';
import { TileCoord, TileRect, chebyshev } from './geometry';
import { Placed, isBlocked } from './rules';

/** Floors you can stand on. Soil is excluded so nobody tramples the beds. */
const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>([
  'GRASS',
  'GRASS_FLOWERS',
  'PATH_STONE',
  'PATH_WOOD',
  'DOORWAY',
  'FLOOR_MEDICAL',
  'FLOOR_SOCIAL',
  'RUG',
]);

/** Where a new player appears: the middle of the social-space rug. */
export const PLAYER_START: TileCoord = { x: 12, y: 13 };

export function isWalkable(x: number, y: number, objects: readonly Placed[]): boolean {
  const kind = getTileKind(x, y);
  return !!kind && WALKABLE.has(kind) && !isBlocked(x, y, objects);
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const index = (t: TileCoord) => t.y * HABITAT_COLS + t.x;

/** Breadth-first search over the tile grid. Returns the steps after `from`, or null. */
function search(from: TileCoord, isGoal: (t: TileCoord) => boolean, objects: readonly Placed[]): TileCoord[] | null {
  if (isGoal(from)) return [];
  // Walkability computed once per search instead of once per neighbour visit.
  const walkable = new Uint8Array(HABITAT_COLS * HABITAT_ROWS);
  for (let y = 0; y < HABITAT_ROWS; y++) for (let x = 0; x < HABITAT_COLS; x++) walkable[y * HABITAT_COLS + x] = +isWalkable(x, y, objects);

  const prev = new Map<number, TileCoord | null>([[index(from), null]]);
  const queue: TileCoord[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const [dx, dy] of DIRS) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= HABITAT_COLS || next.y >= HABITAT_ROWS) continue;
      if (prev.has(index(next)) || !walkable[index(next)]) continue;
      prev.set(index(next), cur);
      if (isGoal(next)) {
        const path: TileCoord[] = [];
        for (let t: TileCoord | null = next; t && index(t) !== index(from); t = prev.get(index(t)) ?? null) path.unshift(t);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function findPath(from: TileCoord, to: TileCoord, objects: readonly Placed[]): TileCoord[] | null {
  return search(from, (t) => t.x === to.x && t.y === to.y, objects);
}

/**
 * Shortest path to a tile within reach of a footprint (touching it, else one tile
 * further, e.g. the middle of a soil bed). Null if it can't be reached at all.
 */
export function pathToReach(from: TileCoord, rect: TileRect, objects: readonly Placed[]): TileCoord[] | null {
  for (const reach of [1, 2]) {
    const path = search(from, (t) => {
      const d = chebyshev(t, rect);
      return d > 0 && d <= reach;
    }, objects);
    if (path) return path;
  }
  return null;
}
