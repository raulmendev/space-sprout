import type { Point } from '../types/domain';
import type { TileCoord, TileRect } from './geometry';
import type { RoomId } from './habitat';
import { findPath, isWalkable, pathToReach } from './movement';
import type { Placed } from './rules';

/**
 * Free (non-grid) character motion. Positions are continuous points in tile
 * units at the character's feet. Routes (walking up to something you tapped)
 * come from the tile BFS, then get "string-pulled" into straight segments.
 */

/** Half-size of a character's footprint, in tiles. Small enough to pass 1-tile gaps. */
const FOOT = { hw: 0.28, hh: 0.18 } as const;

export const tileOf = (p: Point): TileCoord => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
export const tileCenter = (t: TileCoord): Point => ({ x: t.x + 0.5, y: t.y + 0.5 });

/** Can a character's feet be at `p` without overlapping anything solid? */
export function canStand(room: RoomId, p: Point, objects: readonly Placed[]): boolean {
  for (const [dx, dy] of [
    [-FOOT.hw, -FOOT.hh],
    [FOOT.hw, -FOOT.hh],
    [-FOOT.hw, FOOT.hh],
    [FOOT.hw, FOOT.hh],
  ]) {
    if (!isWalkable(room, Math.floor(p.x + dx), Math.floor(p.y + dy), objects)) return false;
  }
  return true;
}

/** How far sideways a character is nudged to slip into a nearby opening (tiles). */
const CORNER_ASSIST = 0.6;

/**
 * Move by (dx, dy), sliding along walls: each axis is tried on its own. When a
 * straight push is blocked but an opening (a door, a gap between beds) is within
 * CORNER_ASSIST sideways, ease toward it so nobody has to line up pixel-perfectly.
 */
export function slide(room: RoomId, p: Point, dx: number, dy: number, objects: readonly Placed[]): Point {
  let { x, y } = p;
  const free = (q: Point) => canStand(room, q, objects);
  // Already inside something solid (e.g. a plant appeared underfoot): move freely until out.
  if (!free(p)) return { x: x + dx, y: y + dy };
  if (dx && free({ x: x + dx, y })) x += dx;
  if (dy && free({ x, y: y + dy })) y += dy;
  if (x !== p.x || y !== p.y || (dx && dy)) return { x, y };

  // Pure horizontal or vertical push into something: look for an opening to either side.
  const step = Math.abs(dx || dy);
  for (let off = 0.05; off <= CORNER_ASSIST; off += 0.05) {
    for (const sign of [-1, 1]) {
      const side = sign * off;
      const opening = dx ? { x: x + dx, y: y + side } : { x: x + side, y: y + dy };
      const path = dx ? { x, y: y + side } : { x: x + side, y };
      if (free(opening) && free(path)) {
        const nudge = sign * Math.min(step, off);
        return dx ? { x, y: y + nudge } : { x: x + nudge, y };
      }
    }
  }
  return { x, y };
}

/** Is the straight walk from a to b clear the whole way? */
export function clearLine(room: RoomId, a: Point, b: Point, objects: readonly Placed[]): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!canStand(room, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, objects)) return false;
  }
  return true;
}

/** Keep only the waypoints needed: from each point, jump to the farthest one in plain sight. */
function stringPull(room: RoomId, from: Point, points: Point[], objects: readonly Placed[]): Point[] {
  const out: Point[] = [];
  let cur = from;
  for (let i = 0; i < points.length; ) {
    let j = points.length - 1;
    while (j > i && !clearLine(room, cur, points[j], objects)) j--;
    out.push(points[j]);
    cur = points[j];
    i = j + 1;
  }
  return out;
}

/** Smooth route to somewhere within reach of a footprint (null if unreachable). */
export function planReach(room: RoomId, from: Point, rect: TileRect, objects: readonly Placed[]): Point[] | null {
  const tiles = pathToReach(room, tileOf(from), rect, objects);
  if (!tiles) return null;
  return stringPull(room, from, tiles.map(tileCenter), objects);
}

/** Smooth route to the centre of a tile in the same room (null if unreachable). */
export function planRoute(room: RoomId, from: Point, to: TileCoord, objects: readonly Placed[]): Point[] | null {
  const tiles = findPath(room, tileOf(from), to, objects);
  if (!tiles) return null;
  return stringPull(room, from, tiles.map(tileCenter), objects);
}
