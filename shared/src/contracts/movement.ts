import { FloorEdges, ROOMS, ROOM_COLS, ROOM_ROWS, RoomId, TileKind, doorAt, getTileKind, propAtTile } from './habitat';
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
export const PLAYER_START: HabitatPosition = { room: 'SOCIAL', x: 17.5, y: 13.5 }; // beside the lounge

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

/** Half-size of a character's feet, in tiles. Small enough to pass 1-tile gaps. */
export const FOOT = { hw: 0.28, hh: 0.18 } as const;

/**
 * How far a character's sprite reaches past its feet: sideways, and down (the drawn feet
 * and shadow sit a little below the position). Props only stop the feet; walls keep the
 * whole sprite off them.
 */
const BODY = { hw: 0.5, below: 0.25 } as const;

const OUTER_WALLS: FloorEdges = { left: 1, top: 0, right: ROOM_COLS - 1, bottom: ROOM_ROWS - 1 };

/** Do the feet, at height `y`, only touch rows where this side wall has a door? */
function inDoorway(room: RoomId, side: 'W' | 'E', y: number): boolean {
  const x = side === 'W' ? 0 : ROOM_COLS - 1;
  return !!doorAt(room, x, Math.floor(y - FOOT.hh)) && !!doorAt(room, x, Math.floor(y + FOOT.hh));
}

/** Where the feet can go at height `y` with the sprite clear of the painted walls. */
function footRange(room: RoomId, y: number) {
  const f = ROOMS[room].floor ?? OUTER_WALLS;
  return {
    minX: inDoorway(room, 'W', y) ? -Infinity : f.left + BODY.hw,
    maxX: inDoorway(room, 'E', y) ? Infinity : f.right - BODY.hw,
    minY: f.top + FOOT.hh,
    maxY: f.bottom - BODY.below,
  };
}

/** Can feet at `p` stand there without the sprite overlapping a wall? */
export function clearOfWalls(room: RoomId, p: Point): boolean {
  const r = footRange(room, p.y);
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Where a character stands on a tile: its centre, pulled in off any wall painted over
 * it. Null if the painted wall covers the whole tile.
 */
export function standPoint(room: RoomId, t: TileCoord): Point | null {
  const rows = footRange(room, t.y + 0.5);
  const y = clamp(t.y + 0.5, rows.minY, rows.maxY);
  const { minX, maxX } = footRange(room, y);
  const x = clamp(t.x + 0.5, minX, maxX);
  return x >= t.x && x < t.x + 1 && y >= t.y && y < t.y + 1 ? { x, y } : null;
}

/** Which tiles routes may pass through: walkable, and not hidden under a painted wall. */
const routeGrids = new Map<RoomId, Uint8Array>();
function routeGrid(room: RoomId): Uint8Array {
  let grid = routeGrids.get(room);
  if (!grid) {
    const walkable = walkableGrid(room);
    grid = new Uint8Array(ROOM_COLS * ROOM_ROWS);
    for (let y = 0; y < ROOM_ROWS; y++) {
      for (let x = 0; x < ROOM_COLS; x++) {
        const i = y * ROOM_COLS + x;
        grid[i] = +(walkable[i] === 1 && !!standPoint(room, { x, y }));
      }
    }
    routeGrids.set(room, grid);
  }
  return grid;
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
  const walkable = routeGrid(room);

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
