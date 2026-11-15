import type { Suit } from './members';
import { EMOTES, type EmoteId } from './emotes';
import { ROOM_IDS, type RoomId } from './habitat';
import type { HabitatPosition } from './movement';

/**
 * Presence: where everyone in the station is standing, right now. It lives only in memory and on
 * the live channel (never in the database): a player who closes the app simply leaves.
 */
export const FACINGS = ['down', 'up', 'left', 'right'] as const;
export type Facing = (typeof FACINGS)[number];

/** Where a player stands and how: what their device sends as they move. */
export interface Stance {
  at: HabitatPosition;
  facing: Facing;
  moving: boolean;
}

/** Who a presence belongs to: enough to draw them (their suit) and tag them (their name). */
export interface PresenceMember {
  id: string;
  name: string;
  suit: Suit;
}

/** How often a moving player's device reports where it is. */
export const PRESENCE_EVERY_MS = 100;

/** A stance as it came off the wire, checked: a room that exists, a point inside it, a known facing. */
export function readStance(value: unknown): Stance | null {
  const s = value as Partial<Stance> | null;
  const at = s?.at as Partial<HabitatPosition> | undefined;
  const coord = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 200;
  if (!at || !ROOM_IDS.includes(at.room as RoomId) || !coord(at.x) || !coord(at.y)) return null;
  if (!FACINGS.includes(s!.facing as Facing) || typeof s!.moving !== 'boolean') return null;
  return { at: { room: at.room as RoomId, x: at.x as number, y: at.y as number }, facing: s!.facing as Facing, moving: s!.moving };
}

export const isEmote = (id: unknown): id is EmoteId => EMOTES.some((e) => e.id === id);
