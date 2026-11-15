import { type Actor, type CrewId, type CrewMember, type HealthMetric, type User, crewFor, metricsFor } from '@garden/shared';

/** The two demo accounts. Astronaut and family share one garden, each with their own health record. */
export const ASTRONAUT_USER: User = { id: 'astronaut-demo', displayName: 'Astronaut', role: 'ASTRONAUT' };
export const FAMILY_USER: User = { id: 'family-demo', displayName: 'Family', role: 'FAMILY' };

/** The astronaut's suit colours. Art only: nothing else changes. */
export const SUITS = ['turquoise', 'green', 'black', 'wine', 'purple', 'cactus', 'leaf'] as const;
export type Suit = (typeof SUITS)[number];

/**
 * What the start menu asks: name, astronaut or family, suit, and a station key.
 * Kept in this browser until there are accounts. The station key is only stored
 * for now; joining another station needs the backend.
 */
export interface PlayerProfile {
  name: string;
  role: User['role'];
  suit: Suit;
  stationKey: string;
}
export const NAME_MAX = 16;
const PROFILE_KEY = 'jardin-comunal:profile:v1';

function readProfile(): PlayerProfile | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Partial<PlayerProfile> | null;
    if (!p || (p.role !== 'ASTRONAUT' && p.role !== 'FAMILY')) return null;
    return {
      name: String(p.name ?? '').trim().slice(0, NAME_MAX),
      role: p.role,
      suit: SUITS.find((s) => s === p.suit) ?? 'turquoise',
      stationKey: String(p.stationKey ?? ''),
    };
  } catch {
    return null;
  }
}

/** The saved profile, if this browser has been through the start menu. */
export const SAVED_PROFILE = readProfile();

/** `?user=` / `?suit=` still win over the profile (handy for testing two players side by side). */
const URL_PARAMS = (() => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
})();

/** First visit, with nothing in the URL either: show the start menu. */
export const NEEDS_PROFILE = !SAVED_PROFILE && !URL_PARAMS.has('user') && !URL_PARAMS.has('suit');

/** Save the start menu's answers and reload into the game with them (the URL's overrides dropped). */
export function saveProfile(p: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...p, name: p.name.trim().slice(0, NAME_MAX), stationKey: p.stationKey.trim() }));
  } catch {
    // Private mode: the choice still applies to this visit through the URL below.
  }
  const q = new URLSearchParams(location.search);
  q.delete('user');
  q.delete('suit');
  if (!readProfile()) {
    if (p.role === 'FAMILY') q.set('user', 'family');
    if (p.suit !== 'turquoise') q.set('suit', p.suit);
  }
  const s = q.toString();
  location.assign(`${location.pathname}${s ? `?${s}` : ''}`);
}

/**
 * Who is playing on this page: the URL's `?user=family` if given, else the saved
 * profile, else the astronaut. The profile's name replaces the role's label when
 * the role matches. Fixed for the page's lifetime, so switching is a reload.
 */
export const CURRENT_USER: User = (() => {
  const asked = URL_PARAMS.get('user')?.toLowerCase();
  const role = asked ? (asked === 'family' ? 'FAMILY' : 'ASTRONAUT') : (SAVED_PROFILE?.role ?? 'ASTRONAUT');
  const base = role === 'FAMILY' ? FAMILY_USER : ASTRONAUT_USER;
  const name = SAVED_PROFILE?.role === role ? SAVED_PROFILE.name : '';
  return name ? { ...base, displayName: name } : base;
})();

export const ROLE = CURRENT_USER.role;

/** The suit this page shows: `?suit=green|black|wine|purple|cactus|leaf`, else the profile's, else turquoise. */
export const SUIT: Suit = SUITS.find((s) => s === URL_PARAMS.get('suit')?.toLowerCase()) ?? SAVED_PROFILE?.suit ?? 'turquoise';

export const IS_FAMILY = ROLE === 'FAMILY';

export const asActor = (u: User): Actor => ({ id: u.id, name: u.displayName });

/** The readings this player logs, in checklist order. */
export const MY_METRICS: readonly HealthMetric[] = metricsFor(ROLE);

/** The crew as this player meets them (each asks only about this player's readings). */
export const MY_CREW: readonly CrewMember[] = crewFor(ROLE);
export const MY_CREW_BY_ID = Object.fromEntries(MY_CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;

/** Whether a note, plant or purchase came from the astronaut (as opposed to the family). */
export const isAstronaut = (actorId: string): boolean => actorId === ASTRONAUT_USER.id;
