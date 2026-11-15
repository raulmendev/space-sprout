import type { HealthMeasurement, HealthMetric } from '../types/domain';
import { dayOf } from './health';

/**
 * Descriptive insights over the astronaut's own readings: averages, highs and lows, and how
 * today compares with their own usual range. Never a diagnosis and never a judgement: no
 * "good" or "bad" values, only "within / above / below your usual".
 */

/** One value per day: that day's latest reading. */
export interface DayValue {
  day: string;
  value: number;
}

/** Metrics that add up over the mission rather than describe a single day (shown as a total). */
export const CUMULATIVE_METRICS: readonly HealthMetric[] = ['RADIATION'];

export const INSIGHT_RULES = {
  /** Days of history the usual range is drawn from. */
  usualWindowDays: 30,
  /** Fewest earlier days needed before a usual range is shown. */
  usualMinDays: 4,
} as const;

/** One value per day (the day's latest reading), oldest first. */
export function dailyValues(readings: readonly Pick<HealthMeasurement, 'value' | 'measuredAt'>[]): DayValue[] {
  const latest = new Map<string, { at: string; value: number }>();
  for (const r of readings) {
    const day = dayOf(r.measuredAt);
    const prev = latest.get(day);
    if (!prev || prev.at < r.measuredAt) latest.set(day, { at: r.measuredAt, value: r.value });
  }
  return [...latest].map(([day, v]) => ({ day, value: v.value })).sort((a, b) => a.day.localeCompare(b.day));
}

/** The UTC day `n` days before `day` (YYYY-MM-DD). */
export function daysBefore(day: string, n: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') - n * 86_400_000).toISOString().slice(0, 10);
}

/** Days within the last `windowDays` up to and including `today`. */
export function lastDays(values: readonly DayValue[], windowDays: number, today: string): DayValue[] {
  const from = daysBefore(today, windowDays - 1);
  return values.filter((v) => v.day >= from && v.day <= today);
}

export interface UsualRange {
  lo: number;
  hi: number;
}

/** The middle half of the days before `day`, over the usual window; null with too little history. */
export function usualRange(values: readonly DayValue[], day: string): UsualRange | null {
  const from = daysBefore(day, INSIGHT_RULES.usualWindowDays);
  const earlier = values.filter((v) => v.day >= from && v.day < day).map((v) => v.value).sort((a, b) => a - b);
  if (earlier.length < INSIGHT_RULES.usualMinDays) return null;
  return { lo: quantile(earlier, 0.25), hi: quantile(earlier, 0.75) };
}

export type Comparison = 'BELOW' | 'WITHIN' | 'ABOVE';

export function compareToUsual(value: number, usual: UsualRange | null): Comparison | null {
  if (!usual) return null;
  if (value < usual.lo) return 'BELOW';
  if (value > usual.hi) return 'ABOVE';
  return 'WITHIN';
}

export interface MetricSummary {
  /** The values in the window, oldest first. */
  days: DayValue[];
  latest: DayValue | null;
  average: number | null;
  highest: DayValue | null;
  lowest: DayValue | null;
  /** Sum over the window, for cumulative metrics (radiation dose). */
  total: number | null;
  usual: UsualRange | null;
  /** The latest day against the usual range. */
  comparison: Comparison | null;
}

/** Everything the insights show for one metric over the last `windowDays` days. */
export function summarize(metric: HealthMetric, readings: readonly Pick<HealthMeasurement, 'value' | 'measuredAt'>[], windowDays: number, today: string): MetricSummary {
  const all = dailyValues(readings);
  const days = lastDays(all, windowDays, today);
  const latest = days.at(-1) ?? null;
  const values = days.map((d) => d.value);
  const usual = latest ? usualRange(all, latest.day) : null;
  return {
    days,
    latest,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    highest: days.reduce<DayValue | null>((m, d) => (!m || d.value > m.value ? d : m), null),
    lowest: days.reduce<DayValue | null>((m, d) => (!m || d.value < m.value ? d : m), null),
    total: CUMULATIVE_METRICS.includes(metric) ? values.reduce((a, b) => a + b, 0) : null,
    usual,
    comparison: latest ? compareToUsual(latest.value, usual) : null,
  };
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
