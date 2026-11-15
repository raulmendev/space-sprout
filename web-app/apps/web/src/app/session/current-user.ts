import { type Actor, type CrewId, type CrewMember, DEMO_MEMBERS, type HealthMetric, type Member, ROLE_COLORS, type Suit, type User, crewFor, metricsFor } from '@garden/shared';
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
 * The start menu's Start: saved on the server (joining or starting a station as needed),
 * then a reload into the game as that player, with any dev URL stand-in dropped.
 * Throws with a message for the menu to show.
 */
export async function saveProfile(p: PlayerChoice): Promise<void> {
  await savePlayer(p);
  location.assign(location.pathname);
}

/** "That's me" in the start menu: sign in as someone already in the station, then reload as them. */
export async function switchTo(key: string, memberId: string): Promise<void> {
  await signInAs(key, memberId);
  location.assign(location.pathname);
}

/** Who is playing on this page (the astronaut behind the start menu). Fixed for the page's lifetime. */
export const CURRENT_USER: User = MEMBER ?? ASTRONAUT_USER;

export const ROLE = CURRENT_USER.role;

/** The suit this page shows. Art only: nothing else changes. */
export const SUIT: Suit = MEMBER?.suit ?? 'turquoise';

export const IS_FAMILY = ROLE === 'FAMILY';

export const asActor = (u: User): Actor => ({ id: u.id, name: u.displayName });

/** The readings this player logs, in checklist order. */
export const MY_METRICS: readonly HealthMetric[] = metricsFor(ROLE);

/** The crew as this player meets them (each asks only about this player's readings). */
export const MY_CREW: readonly CrewMember[] = crewFor(ROLE);
export const MY_CREW_BY_ID = Object.fromEntries(MY_CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;

/** Everyone whose name can appear here: this station, plus the demo members credited in the demo garden. */
const PEOPLE = new Map<string, Member>([...DEMO_MEMBERS, ...householdMembers()].map((m) => [m.id, m]));

/** Who did something, for names and colours: their member, or a plain family stand-in if they're unknown. */
export function authorOf(id: string): Pick<Member, 'displayName' | 'role' | 'color'> {
  return PEOPLE.get(id) ?? { displayName: 'Someone', role: 'FAMILY', color: ROLE_COLORS.FAMILY };
}

/** Whether a note, plant or purchase came from an astronaut (as opposed to family). */
export const isAstronaut = (actorId: string): boolean => authorOf(actorId).role === 'ASTRONAUT';

/** A localStorage key private to this player. */
export const perMemberKey = (name: string): string => `jardin-comunal:${name}:${CURRENT_USER.id}:v1`;
