import { signal } from '@angular/core';
import { type CrewId, type CrewMember, DEMO_MEMBERS, type HealthMetric, type Member, ROLE_COLORS, type Suit, type User, crewFor, metricsFor } from '@garden/shared';
import { t } from '../i18n/i18n';
import { type PlayerChoice, currentMember, householdMembers, savePlayer, signInAs, stationKey } from './member-session';

/** The two demo members (seeded on the server too, station key GARDEN), credited in the demo garden and notes. */
export const [ASTRONAUT_USER, FAMILY_USER]: readonly User[] = DEMO_MEMBERS;

/** Who this page plays as (main.ts settles it before the game loads); null shows the start menu. */
const MEMBER = currentMember();

/** The start menu's answers as they stand: the current member, if any. */
export const SAVED_PROFILE: PlayerChoice | null = MEMBER && {
  name: MEMBER.displayName,
  role: MEMBER.role,
  suit: MEMBER.suit,
  stationKey: stationKey() ?? '',
};

/** Nobody playing yet: show the start menu. */
export const NEEDS_PROFILE = !MEMBER;

/**
 * The start menu's Start: saved on the server (joining or starting a station as needed).
 * Only a new suit for the same member is put on in place (resolves true: the game carries on).
 * Anything else (a new name, role or station) reloads into the game as that player, with any
 * dev URL stand-in dropped. Throws with a message for the menu to show.
 */
export async function saveProfile(p: PlayerChoice): Promise<boolean> {
  const sameOtherwise = MEMBER !== null && p.name === MEMBER.displayName && p.role === MEMBER.role;
  if ((await savePlayer(p)) === 'updated' && sameOtherwise) {
    mySuit.set(p.suit);
    return true;
  }
  location.assign(location.pathname);
  return false;
}

/** "That's me" in the start menu: sign in as someone already in the station, then reload as them. */
export async function switchTo(key: string, memberId: string): Promise<void> {
  await signInAs(key, memberId);
  location.assign(location.pathname);
}

/** Who is playing on this page (the astronaut behind the start menu). Fixed for the page's lifetime. */
export const CURRENT_USER: User = MEMBER ?? ASTRONAUT_USER;

export const ROLE = CURRENT_USER.role;

/** The suit this player wears. Art only, so it can change mid-game (the start menu). */
const mySuit = signal<Suit>(MEMBER?.suit ?? 'turquoise');
export const MY_SUIT = mySuit.asReadonly();

export const IS_FAMILY = ROLE === 'FAMILY';

/** The readings this player logs, in checklist order. */
export const MY_METRICS: readonly HealthMetric[] = metricsFor(ROLE);

/** The crew as this player meets them (each asks only about this player's readings). */
export const MY_CREW: readonly CrewMember[] = crewFor(ROLE);
export const MY_CREW_BY_ID = Object.fromEntries(MY_CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;

/** Everyone whose name can appear here: this station, plus the demo members credited in the demo garden. */
const PEOPLE = new Map<string, Member>([...DEMO_MEMBERS, ...householdMembers()].map((m) => [m.id, m]));

/** Who did something, for names and colours: their member, or a plain family stand-in if they're unknown. */
export function authorOf(id: string): Pick<Member, 'displayName' | 'role' | 'color'> {
  return PEOPLE.get(id) ?? { displayName: t('Someone'), role: 'FAMILY', color: ROLE_COLORS.FAMILY };
}

/** Whether a note, plant or purchase came from an astronaut (as opposed to family). */
export const isAstronaut = (actorId: string): boolean => authorOf(actorId).role === 'ASTRONAUT';

/** A localStorage key private to this player. */
export const perMemberKey = (name: string): string => `jardin-comunal:${name}:${CURRENT_USER.id}:v1`;
