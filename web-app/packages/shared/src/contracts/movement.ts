import { ROOM_COLS, ROOM_ROWS, RoomId, TileKind, doorAt, getTileKind } from './habitat';
import type { Point } from '../types/domain';
import { TileCoord, TileRect, chebyshev } from './geometry';
import { Placed, isBlocked } from './rules';

/** Floors you can stand on. Soil is walkable; plants (placed objects) still block their footprint. */
const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>([
  'SOIL',
  'GRASS',
  'GRASS_FLOWERS',
  'PATH_STONE',
  'PATH_WOOD',
  'DOORWAY',
  'FLOOR_MEDICAL',
  'FLOOR_SOCIAL',
  'RUG',
]);

/** A character's feet anywhere in the habitat: room + continuous point in tile units. */
export interface HabitatPosition extends Point {
  room: RoomId;
}

/** Where a new player appears: the middle of the social-space rug. */
export const PLAYER_START: HabitatPosition = { room: 'SOCIAL', x: 17.5, y: 13.5 }; // beside the lounge

export function isWalkable(room: RoomId, x: number, y: number, objects: readonly Placed[]): boolean {
  const kind = getTileKind(room, x, y);
  return !!kind && WALKABLE.has(kind) && !isBlocked(room, x, y, objects);
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const index = (t: TileCoord) => t.y * ROOM_COLS + t.x;

/** Breadth-first search within one room. Returns the steps after `from`, or null. */
function search(room: RoomId, from: TileCoord, isGoal: (t: TileCoord) => boolean, objects: readonly Placed[]): TileCoord[] | null {
  if (isGoal(from)) return [];
  // Walkability computed once per search instead of once per neighbour visit.
  const walkable = new Uint8Array(ROOM_COLS * ROOM_ROWS);
  for (let y = 0; y < ROOM_ROWS; y++) for (let x = 0; x < ROOM_COLS; x++) walkable[y * ROOM_COLS + x] = +isWalkable(room, x, y, objects);

  const prev = new Map<number, TileCoord | null>([[index(from), null]]);
  const queue: TileCoord[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const [dx, dy] of DIRS) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= ROOM_COLS || next.y >= ROOM_ROWS) continue;
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

export function findPath(room: RoomId, from: TileCoord, to: TileCoord, objects: readonly Placed[]): TileCoord[] | null {
  return search(room, from, (t) => t.x === to.x && t.y === to.y, objects);
}

/**
 * Shortest path to a tile within reach of a footprint (touching it, else one tile
 * further if it's boxed in). Never ends on a door, so walking up to
 * something can't accidentally change rooms. Null if it can't be reached.
 */
export function pathToReach(room: RoomId, from: TileCoord, rect: TileRect, objects: readonly Placed[]): TileCoord[] | null {
  for (const reach of [1, 2]) {
    const path = search(room, from, (t) => {
      const d = chebyshev(t, rect);
      return d > 0 && d <= reach && !doorAt(room, t.x, t.y);
    }, objects);
    if (path) return path;
  }
  return null;
}
