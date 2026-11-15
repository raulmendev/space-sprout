import type { HealthMeasurement, HealthMetric, MeasurementSource, RewardTransaction, UserRole } from '../types/domain';

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
  BODY_TEMP: {
    id: 'BODY_TEMP',
    label: 'Body temperature',
    unit: '°C',
    min: 34,
    max: 42,
    step: 0.1,
    input: 'number',
    about: 'Your temperature today. In orbit it tends to run a little warmer than on Earth.',
  },
  STRESS: {
    id: 'STRESS',
    label: 'Stress',
    unit: '/5',
    min: 1,
    max: 5,
    step: 1,
    input: 'scale',
    about: 'How tense you feel, from low to too high. Some pressure helps you focus; too much is worth a breather.',
  },
  CALORIES: {
    id: 'CALORIES',
    label: 'Calories',
    unit: 'kcal',
    min: 0,
    max: 8000,
    step: 50,
    input: 'number',
    about: 'Roughly what you ate today. The galley plans meals around about 2,500 kcal a day.',
  },
  CO2: {
    id: 'CO2',
    label: 'Cabin CO₂',
    unit: 'ppm',
    min: 0,
    max: 10000,
    step: 10,
    input: 'number',
    about: "Carbon dioxide in the cabin air, from the station's sensors. The scrubbers keep it in check.",
  },
};

/** The same readings told for someone at home on Earth, where the station's version doesn't fit. */
const EARTH_ABOUT: Partial<Record<HealthMetric, string>> = {
  SLEEP: 'Hours you slept last night. Your own pattern over the week tells you more than any single night.',
  ACTIVITY: 'Minutes of exercise today: a brisk walk, a bike ride, sport or the gym.',
  WATER: 'Litres you drank today, water and other drinks included.',
};

/** A metric's explanation, as told to this role. */
export function aboutFor(metric: HealthMetric, role: UserRole = 'ASTRONAUT'): string {
  return (role === 'FAMILY' ? EARTH_ABOUT[metric] : undefined) ?? METRICS[metric].about;
}

/** The medical terminal's daily checklist (and the wearable's sync). */
export const METRIC_ORDER: readonly HealthMetric[] = ['HEART_RATE', 'SLEEP', 'ACTIVITY', 'MOOD', 'WATER', 'RADIATION'];

/** Every reading: the terminal's, plus the ones only the crew ask about. Health Insights shows them all. */
export const ALL_METRICS: readonly HealthMetric[] = [...METRIC_ORDER, 'BODY_TEMP', 'STRESS', 'CALORIES', 'CO2'];

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
  /** Seeds per rewarded reading when no band applies; bands (checkin.ts) pay 1–4 instead. */
  perReading: 3,
  /** Rewarded readings per metric per day. */
  perMetricPerDay: 1,
  /** Seeds per day from check-ins, across all metrics: a full day of top answers fits under it. */
  dailyCap: 30,
} as const;

export type RewardOutcome = 'REWARDED' | 'ALREADY_REWARDED' | 'METRIC_DONE_TODAY' | 'DAILY_CAP';

export const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * How many seeds a new reading earns, given what was already granted.
 * `worth` is what the answer pays before limits (see `rewardFor` in checkin.ts).
 * Pure and deterministic: the server will run the same function inside a
 * transaction, with a unique constraint on measurementId as the backstop.
 */
export function decideReward(
  m: Pick<HealthMeasurement, 'id' | 'metric' | 'measuredAt'>,
  ledger: readonly Pick<RewardTransaction, 'measurementId' | 'metric' | 'day' | 'amount' | 'reason'>[],
  worth: number = CHECK_IN_REWARD.perReading,
): { outcome: RewardOutcome; amount: number } {
  const checkIns = ledger.filter((r) => (r.reason ?? 'CHECK_IN') === 'CHECK_IN'); // goal and streak bonuses don't count here
  if (checkIns.some((r) => r.measurementId === m.id)) return { outcome: 'ALREADY_REWARDED', amount: 0 };
  const day = dayOf(m.measuredAt);
  const today = checkIns.filter((r) => r.day === day);
  if (today.filter((r) => r.metric === m.metric).length >= CHECK_IN_REWARD.perMetricPerDay) {
    return { outcome: 'METRIC_DONE_TODAY', amount: 0 };
  }
  const earned = today.reduce((sum, r) => sum + r.amount, 0);
  const amount = Math.min(worth, CHECK_IN_REWARD.dailyCap - earned);
  return amount > 0 ? { outcome: 'REWARDED', amount } : { outcome: 'DAILY_CAP', amount: 0 };
}
