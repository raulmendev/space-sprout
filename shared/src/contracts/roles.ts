import type { HealthMetric, UserRole } from '../types/domain';
import { ALL_METRICS } from './health';
import { CREW, type CrewMember } from './crew';

/**
 * Who logs which readings. The astronaut keeps every reading, the station's included;
 * the family, at home on Earth, keep only the everyday ones a person can know about
 * themselves. Planting, notes, the store and decorations are the same for both.
 */
export const ROLE_METRICS: Record<UserRole, readonly HealthMetric[]> = {
  ASTRONAUT: ALL_METRICS,
  FAMILY: ['HEART_RATE', 'SLEEP', 'ACTIVITY', 'MOOD', 'WATER', 'STRESS'],
};

export function metricsFor(role: UserRole): readonly HealthMetric[] {
  return ROLE_METRICS[role];
}

/**
 * The crew as this role meets them: each member keeps only the readings this role logs.
 * Members left with nothing to ask (the scientist, for the family) are still there to say
 * hello, so they stay in the list with no metrics.
 */
export function crewFor(role: UserRole): readonly CrewMember[] {
  const mine = new Set(ROLE_METRICS[role]);
  return CREW.map((c) => ({ ...c, metrics: c.metrics.filter((m) => mine.has(m)) }));
}
