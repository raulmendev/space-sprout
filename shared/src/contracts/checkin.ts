import type { HealthMetric, UserRole } from '../types/domain';
import { CHECK_IN_REWARD } from './health';

/**
 * How the crew read an answer: each reading falls in a band, and the band says
 * how many seeds it pays (x1–x4) and which reply the crew give. Numbers stay
 * numbers in the record; bands are only how they're read back. Shared so the
 * server pays exactly the same.
 *
 * Bands are checked in order and the first that fits wins, so a band that starts where
 * the previous one's `upTo` ends doesn't claim that shared value (100 bpm is Regular,
 * 100.5 is High).
 *
 * Game feedback, not diagnosis: the bands are the design team's targets for
 * the demo and never shown as medical ranges.
 */
export interface Band {
  /** Stable id the dialogue lines are keyed by (several ranges may share one, e.g. too warm / too cold). */
  id: string;
  /** Short label, e.g. for answer buttons. */
  label: string;
  /** Seeds this answer pays (before the daily limits). */
  pays: number;
  /** Inclusive lower bound. */
  min?: number;
  /** Exclusive upper bound. */
  max?: number;
  /** Inclusive upper bound, for ranges like "50–100 bpm" that include their top value. */
  upTo?: number;
  /** For scale readings: the one value this band is (its button). */
  value?: number;
  icon?: string;
}

/** "I don't know": no reading is stored, but asking still pays a little. */
export const UNKNOWN_BAND = 'UNKNOWN';

export interface MetricBands {
  bands: readonly Band[];
  /** Seeds for answering "don't know" (only where the crew offer it). */
  unknownPays?: number;
}

export const CHECKIN_BANDS: Partial<Record<HealthMetric, MetricBands>> = {
  // Asked as hours, answered like "How are you sleeping?".
  SLEEP: {
    bands: [
      { id: 'BAD', label: 'Bad', pays: 1, max: 5 },
      { id: 'REGULAR', label: 'Regular', pays: 2, min: 5, max: 6.5 },
      { id: 'GOOD', label: 'Good', pays: 3, min: 6.5, max: 7.5 },
      { id: 'GREAT', label: 'Great', pays: 4, min: 7.5, max: 9.5 },
      { id: 'GOOD', label: 'Good', pays: 3, min: 9.5 },
    ],
  },
  BODY_TEMP: {
    bands: [
      { id: 'BAD', label: 'Bad', pays: 1, max: 35.5 },
      { id: 'GOOD', label: 'Good', pays: 2, min: 35.5, max: 36.1 },
      { id: 'GREAT', label: 'Great', pays: 3, min: 36.1, upTo: 37.2 },
      { id: 'GOOD', label: 'Good', pays: 2, min: 37.2, max: 37.8 },
      { id: 'BAD', label: 'Bad', pays: 1, min: 37.8 },
    ],
    unknownPays: 1,
  },
  HEART_RATE: {
    bands: [
      { id: 'LOW', label: 'Low', pays: 1, max: 50 },
      { id: 'REGULAR', label: 'Regular', pays: 3, min: 50, upTo: 100 },
      { id: 'HIGH', label: 'High', pays: 1, min: 100 },
    ],
    unknownPays: 1,
  },
  // Mood is never judged: every answer pays the same; bands only pick the reply.
  MOOD: {
    bands: [
      { id: 'LOW', label: 'Low', pays: 3, max: 3 },
      { id: 'OKAY', label: 'Okay', pays: 3, min: 3, max: 4 },
      { id: 'GOOD', label: 'Good', pays: 3, min: 4 },
    ],
  },
  ACTIVITY: {
    bands: [
      { id: 'NOPE', label: 'Nope', pays: 1, max: 1 },
      { id: 'LITTLE', label: 'A little bit', pays: 2, min: 1, max: 30 },
      { id: 'YES', label: 'Yes!', pays: 3, min: 30 },
    ],
  },
  STRESS: {
    bands: [
      { id: 'LOW', label: 'Low', icon: '😌', pays: 3, value: 1 },
      { id: 'MODERATE', label: 'Moderate', icon: '🙂', pays: 3, value: 2 },
      { id: 'OPTIMAL', label: 'Optimal', icon: '💪', pays: 3, value: 3 },
      { id: 'HIGH', label: 'High', icon: '😣', pays: 2, value: 4 },
      { id: 'TOO_HIGH', label: 'Too high', icon: '🤯', pays: 1, value: 5 },
    ],
  },
  CALORIES: {
    bands: [
      { id: 'LOW', label: 'Under 2,500', pays: 2, max: 2300 },
      { id: 'JUST_RIGHT', label: 'About 2,500', pays: 3, min: 2300, upTo: 2700 },
      { id: 'HIGH', label: 'Over 2,500', pays: 2, min: 2700 },
    ],
  },
  WATER: {
    bands: [
      { id: 'LOW', label: 'Under 3.5 L', pays: 3, max: 3.5 },
      { id: 'JUST_RIGHT', label: '3.5–4 L', pays: 4, min: 3.5, upTo: 4 },
      { id: 'HIGH', label: 'Over 4 L', pays: 2, min: 4 },
    ],
  },
  // The station's environment: the scientist's scan pays for checking, whatever the level.
  RADIATION: {
    bands: [
      { id: 'LOW', label: 'Low', pays: 2, max: 0.5 },
      { id: 'NORMAL', label: 'Normal', pays: 2, min: 0.5, max: 1 },
      { id: 'HIGH', label: 'High', pays: 2, min: 1 },
    ],
  },
  CO2: {
    bands: [
      { id: 'FRESH', label: 'Fresh', pays: 2, max: 2500 },
      { id: 'FINE', label: 'Fine', pays: 2, min: 2500, max: 5000 },
      { id: 'HIGH', label: 'High', pays: 2, min: 5000 },
    ],
  },
};

/**
 * Where life on Earth reads differently: water (no fluid shift, so the usual couple of litres).
 * Everything not listed here is read the same as on the station.
 */
export const EARTH_BANDS: Partial<Record<HealthMetric, MetricBands>> = {
  WATER: {
    bands: [
      { id: 'LOW', label: 'Under 1.5 L', pays: 2, max: 1.5 },
      { id: 'JUST_RIGHT', label: '1.5–3 L', pays: 3, min: 1.5, upTo: 3 },
      { id: 'HIGH', label: 'Over 3 L', pays: 2, min: 3 },
    ],
  },
};

/** The bands for a reading, as this role is read. */
export function bandsFor(metric: HealthMetric, role: UserRole = 'ASTRONAUT'): MetricBands | undefined {
  return (role === 'FAMILY' ? EARTH_BANDS[metric] : undefined) ?? CHECKIN_BANDS[metric];
}

/** The band a reading falls in, or null for metrics without bands. */
export function bandFor(metric: HealthMetric, value: number, role: UserRole = 'ASTRONAUT'): Band | null {
  const def = bandsFor(metric, role);
  if (!def) return null;
  return (
    def.bands.find((b) =>
      b.value !== undefined
        ? b.value === Math.round(value)
        : (b.min === undefined || value >= b.min) && (b.max === undefined || value < b.max) && (b.upTo === undefined || value <= b.upTo),
    ) ?? null
  );
}

/** Seeds a reading is worth before the daily limits. */
export function rewardFor(metric: HealthMetric, value: number, role: UserRole = 'ASTRONAUT'): number {
  return bandFor(metric, value, role)?.pays ?? CHECK_IN_REWARD.perReading;
}

/** Seeds for "don't know", or null where the crew don't offer it. */
export function unknownRewardFor(metric: HealthMetric, role: UserRole = 'ASTRONAUT'): number | null {
  return bandsFor(metric, role)?.unknownPays ?? null;
}

/** Answer buttons for scale readings (stress). */
export function choicesFor(metric: HealthMetric, role: UserRole = 'ASTRONAUT'): readonly Band[] {
  return bandsFor(metric, role)?.bands.filter((b) => b.value !== undefined) ?? [];
}
