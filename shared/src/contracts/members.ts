import type { User, UserRole } from '../types/domain';

export const USER_ROLES = ['ASTRONAUT', 'FAMILY'] as const satisfies readonly UserRole[];

/** The astronaut suit colours there is art for. Art only: nothing else changes with the suit. */
export const SUITS = ['turquoise', 'green', 'black', 'wine', 'purple', 'cactus', 'leaf'] as const;
export type Suit = (typeof SUITS)[number];

/** Each role's colour (notes, name tags) until a member picks their own. */
export const ROLE_COLORS: Record<UserRole, string> = { ASTRONAUT: '#a9dcf2', FAMILY: '#ffe27a' };

/**
 * A person in a household. Everyone in one household shares the station, the garden,
 * the seeds and the inventory; each keeps their own health record. A household can
 * have many family members, each with their own suit and colour (their notes, their
 * name tag), so nothing should tell people apart by comparing ids against a constant.
 */
export interface Member extends User {
  householdId: string;
  suit: Suit;
  /** `#rrggbb`: their notes on the message board, their name tag. */
  color: string;
}

export const DISPLAY_NAME_MAX = 16;

/**
 * A station key is how a household is joined: someone starts a station, and the family
 * types its key in the start menu. Six letters and digits, without look-alikes (0/O, 1/I/L).
 */
export const STATION_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const STATION_KEY_LENGTH = 6;

/** A key as typed (any case, spaces or dashes) in the form it's stored. */
export const normalizeStationKey = (typed: string): string => typed.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The seeded demo station (key GARDEN). Its member ids match the old local demo users, so their credits still resolve. */
export const DEMO_MEMBERS: readonly Member[] = [
  { id: 'astronaut-demo', householdId: 'demo-household', displayName: 'Astronaut', role: 'ASTRONAUT', suit: 'turquoise', color: ROLE_COLORS.ASTRONAUT },
  { id: 'family-demo', householdId: 'demo-household', displayName: 'Family', role: 'FAMILY', suit: 'green', color: ROLE_COLORS.FAMILY },
];
