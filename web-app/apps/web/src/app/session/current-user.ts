import { type Actor, type CrewId, type CrewMember, type HealthMetric, type User, crewFor, metricsFor } from '@garden/shared';

/** The two demo accounts. Astronaut and family share one garden, each with their own health record. */
export const ASTRONAUT_USER: User = { id: 'astronaut-demo', displayName: 'Astronaut', role: 'ASTRONAUT' };
export const FAMILY_USER: User = { id: 'family-demo', displayName: 'Family', role: 'FAMILY' };

/**
 * Who is playing on this page. Until there are accounts it comes from the URL:
 * `?user=family` plays as the family, anything else as the astronaut. Fixed for the
 * page's lifetime, so switching is a reload (or a second tab with the other URL).
 */
export const CURRENT_USER: User = (() => {
  try {
    return new URLSearchParams(location.search).get('user')?.toLowerCase() === 'family' ? FAMILY_USER : ASTRONAUT_USER;
  } catch {
    return ASTRONAUT_USER;
  }
})();

export const ROLE = CURRENT_USER.role;
export const IS_FAMILY = ROLE === 'FAMILY';

export const asActor = (u: User): Actor => ({ id: u.id, name: u.displayName });

/** The readings this player logs, in checklist order. */
export const MY_METRICS: readonly HealthMetric[] = metricsFor(ROLE);

/** The crew as this player meets them (each asks only about this player's readings). */
export const MY_CREW: readonly CrewMember[] = crewFor(ROLE);
export const MY_CREW_BY_ID = Object.fromEntries(MY_CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;

/** Whether a note, plant or purchase came from the astronaut (as opposed to the family). */
export const isAstronaut = (actorId: string): boolean => actorId === ASTRONAUT_USER.id;
