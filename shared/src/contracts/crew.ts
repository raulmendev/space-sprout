import type { CrewId, HealthMetric, NpcId, PetId } from '../types/domain';
import type { HabitatPosition } from './movement';

/**
 * The station crew: four NPCs who wander the whole station and, when the
 * astronaut hasn't logged one of "their" readings today, come over and ask.
 * They remind; the medical terminal stays the full check-in.
 */
export interface CrewMember {
  id: CrewId;
  name: string;
  role: string;
  /** Readings this crew member asks about, in the order they ask. */
  metrics: readonly HealthMetric[];
  /** Reads all their metrics with their own instruments in one go, instead of asking. */
  scans?: boolean;
  /** Where they are when the station starts. */
  start: HabitatPosition;
}

/** Each looks after the readings that fit their job; every reading has exactly one owner. */
export const CREW: readonly CrewMember[] = [
  { id: 'MEDIC', name: 'Dr. Mira', role: 'Medic', metrics: ['MOOD', 'SLEEP', 'BODY_TEMP', 'HEART_RATE'], start: { room: 'MEDICAL', x: 15.5, y: 9.5 } },
  { id: 'TRAINER', name: 'Coach Tao', role: 'Trainer', metrics: ['ACTIVITY', 'STRESS'], start: { room: 'SOCIAL', x: 4.5, y: 12.5 } },
  { id: 'CHEF', name: 'Chef Rosa', role: 'Chef', metrics: ['CALORIES', 'WATER'], start: { room: 'SOCIAL', x: 20.5, y: 5.5 } },
  { id: 'SCIENTIST', name: 'Dr. Okafor', role: 'Scientist', metrics: ['RADIATION', 'CO2'], scans: true, start: { room: 'GARDEN', x: 17.5, y: 8 } },
];

export const PETS: readonly PetId[] = ['DOG', 'CAT'];
export const isPet = (id: NpcId): id is PetId => (PETS as readonly NpcId[]).includes(id);
/** A crew member, as opposed to Sprout or a pet. */
export const isCrew = (id: NpcId): id is CrewId => id !== 'SPROUT' && !isPet(id);

export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;

/** How often the crew may come over unasked. Friendly, never nagging. */
export const CREW_REMINDER = {
  /** The same crew member asks again at most this often (if you said "Later"). */
  perMemberMs: 5 * 60_000,
  /** At most one unasked reminder from anyone in this window. */
  anyoneMs: 45_000,
  /** Quiet time after the station opens. */
  firstAfterMs: 15_000,
  /** They only notice you this close (tiles), and in the same room. */
  noticeRadius: 5,
  /** Walking further than this from them drops the question (tiles). */
  leaveRadius: 6,
} as const;

/** The first of this member's readings not answered today, or null when they're all done. */
export function nextAsk(member: CrewMember, loggedToday: Partial<Record<HealthMetric, unknown>>): HealthMetric | null {
  return member.metrics.find((m) => !loggedToday[m]) ?? null;
}
