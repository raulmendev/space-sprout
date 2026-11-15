import type { HealthMeasurement, HealthMetric, MeasurementSource, RewardTransaction } from '../types/domain';

/**
 * Health check-in rules shared by the web client and (later) the API.
 * Demonstration metrics only: no thresholds, no diagnosis, nothing inferred.
 */

export interface MetricDefinition {
  id: HealthMetric;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  input: 'number' | 'scale';
  /** Neutral, non-clinical explanation shown next to the trend. */
  about: string;
}

export const METRICS: Record<HealthMetric, MetricDefinition> = {
  HEART_RATE: {
    id: 'HEART_RATE',
    label: 'Heart rate',
    unit: 'bpm',
    min: 30,
    max: 220,
    step: 1,
    input: 'number',
    about: 'Beats per minute at rest. Your own trend over several days tells you more than any single reading.',
  },
  SLEEP: {
    id: 'SLEEP',
    label: 'Sleep',
    unit: 'h',
    min: 0,
    max: 16,
    step: 0.25,
    input: 'number',
    about: 'Hours in your last sleep period. Schedules shift a lot in orbit; logging it helps you spot your own patterns.',
  },
  ACTIVITY: {
    id: 'ACTIVITY',
    label: 'Exercise',
    unit: 'min',
    min: 0,
    max: 600,
    step: 5,
    input: 'number',
    about: 'Minutes of exercise today: treadmill, bike or resistance training.',
  },
  MOOD: {
    id: 'MOOD',
    label: 'Mood',
    unit: '/5',
    min: 1,
    max: 5,
    step: 1,
    input: 'scale',
    about: 'How you feel, on your own 1–5 scale. It is only for you, and nothing is inferred from it.',
  },
  WATER: {
    id: 'WATER',
    label: 'Water',
    unit: 'L',
    min: 0,
    max: 10,
    step: 0.25,
    input: 'number',
    about: 'Litres you drank today. Fluids shift toward your head in microgravity, so thirst is a less reliable signal up here.',
  },
  RADIATION: {
    id: 'RADIATION',
    label: 'Radiation',
    unit: 'mSv',
    min: 0,
    max: 20,
    step: 0.01,
    input: 'number',
    about: 'Dose from your personal dosimeter over the last day. Logging it builds your own exposure record over the mission.',
  },
};

export const METRIC_ORDER: readonly HealthMetric[] = ['HEART_RATE', 'SLEEP', 'ACTIVITY', 'MOOD', 'WATER', 'RADIATION'];

/** A reading before it is stored (no id/user yet). */
export interface NewMeasurement {
  metric: HealthMetric;
  value: number;
  measuredAt: string;
  source: MeasurementSource;
}

/** Anything that can produce readings: a simulated wearable today, a real device later. */
export interface MeasurementProvider {
  id: string;
  label: string;
  isSimulated: boolean;
  read(): Promise<NewMeasurement[]>;
}

export function validateMeasurement(metric: HealthMetric, value: number): string | null {
  const def = METRICS[metric];
  if (!def) return 'Unknown metric';
  if (!Number.isFinite(value)) return 'Enter a number';
  if (value < def.min || value > def.max) return `Between ${def.min} and ${def.max} ${def.unit}`;
  return null;
}

/** Build a stored measurement. Simulated data is always labelled as such. */
export function toMeasurement(input: NewMeasurement, id: string, userId: string): HealthMeasurement {
  return {
    id,
    userId,
    metric: input.metric,
    value: input.value,
    unit: METRICS[input.metric].unit,
    measuredAt: input.measuredAt,
    source: input.source,
    isSimulated: input.source === 'SIMULATED',
  };
}

// ---------------------------------------------------------------- rewards

/** Health check-ins are the main way to earn seeds (plants pay only a little). */
export const CHECK_IN_REWARD = {
  /** Seeds per rewarded reading. */
  perReading: 3,
  /** Rewarded readings per metric per day. */
  perMetricPerDay: 1,
  /** Seeds per day from check-ins, across all metrics (every reading pays once a day). */
  dailyCap: 18,
} as const;

export type RewardOutcome = 'REWARDED' | 'ALREADY_REWARDED' | 'METRIC_DONE_TODAY' | 'DAILY_CAP';

export const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * How many seeds a new reading earns, given what was already granted.
 * Pure and deterministic: the server will run the same function inside a
 * transaction, with a unique constraint on measurementId as the backstop.
 */
export function decideReward(
  m: Pick<HealthMeasurement, 'id' | 'metric' | 'measuredAt'>,
  ledger: readonly Pick<RewardTransaction, 'measurementId' | 'metric' | 'day' | 'amount'>[],
): { outcome: RewardOutcome; amount: number } {
  if (ledger.some((r) => r.measurementId === m.id)) return { outcome: 'ALREADY_REWARDED', amount: 0 };
  const day = dayOf(m.measuredAt);
  const today = ledger.filter((r) => r.day === day);
  if (today.filter((r) => r.metric === m.metric).length >= CHECK_IN_REWARD.perMetricPerDay) {
    return { outcome: 'METRIC_DONE_TODAY', amount: 0 };
  }
  const earned = today.reduce((sum, r) => sum + r.amount, 0);
  const amount = Math.min(CHECK_IN_REWARD.perReading, CHECK_IN_REWARD.dailyCap - earned);
  return amount > 0 ? { outcome: 'REWARDED', amount } : { outcome: 'DAILY_CAP', amount: 0 };
}
