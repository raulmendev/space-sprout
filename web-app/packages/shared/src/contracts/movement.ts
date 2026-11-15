import { ROOM_COLS, ROOM_ROWS, RoomId, TileKind, doorAt, getTileKind, propAtTile } from './habitat';
import type { Point } from '../types/domain';
import { TileCoord, TileRect, chebyshev } from './geometry';

/** Floors you can stand on. Plants never block: characters walk through them (only stations do). */
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
export const PLAYER_START: HabitatPosition = { room: 'SOCIAL', x: 12.5, y: 11.5 };

/** Which tiles of a room can be stood on. Built once per room: only floors and stations decide it. */
const walkableGrids = new Map<RoomId, Uint8Array>();
function walkableGrid(room: RoomId): Uint8Array {
  let grid = walkableGrids.get(room);
  if (!grid) {
    grid = new Uint8Array(ROOM_COLS * ROOM_ROWS);
    for (let y = 0; y < ROOM_ROWS; y++) {
      for (let x = 0; x < ROOM_COLS; x++) {
        const kind = getTileKind(room, x, y);
        grid[y * ROOM_COLS + x] = +(!!kind && WALKABLE.has(kind) && !propAtTile(room, x, y));
      }
    }
    walkableGrids.set(room, grid);
  }
  return grid;
}

export function isWalkable(room: RoomId, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < ROOM_COLS && y < ROOM_ROWS && walkableGrid(room)[y * ROOM_COLS + x] === 1;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const index = (t: TileCoord) => t.y * ROOM_COLS + t.x;

/** Breadth-first search within one room. Returns the steps after `from`, or null. */
function search(room: RoomId, from: TileCoord, isGoal: (t: TileCoord) => boolean): TileCoord[] | null {
  if (isGoal(from)) return [];
  const walkable = walkableGrid(room);

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

export function findPath(room: RoomId, from: TileCoord, to: TileCoord): TileCoord[] | null {
  return search(room, from, (t) => t.x === to.x && t.y === to.y);
}

/**
 * Shortest path to a tile within reach of a footprint (touching it, else one tile
 * further if it's boxed in). Never ends on a door, so walking up to
 * something can't accidentally change rooms. Null if it can't be reached.
 */
export function pathToReach(room: RoomId, from: TileCoord, rect: TileRect): TileCoord[] | null {
  for (const reach of [1, 2]) {
    const path = search(room, from, (t) => {
      const d = chebyshev(t, rect);
      return d > 0 && d <= reach && !doorAt(room, t.x, t.y);
    });
    if (path) return path;
  }
  return null;
}
