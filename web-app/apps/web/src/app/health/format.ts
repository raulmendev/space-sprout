import type { HealthMeasurement, HealthMetric, MeasurementSource, MetricSummary, UsualRange } from '@garden/shared';
import { METRICS } from '@garden/shared';

/** "2 h ago", "yesterday", "3 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Source label with an icon, so it never relies on colour alone. */
export const SOURCE_LABEL: Record<MeasurementSource, string> = {
  SIMULATED: '⚙ Simulated',
  MANUAL: '✎ Entered by you',
  DEVICE: '⌚ Device',
};

/** Compact form for tight spots (full label goes in a tooltip). */
export const SOURCE_SHORT: Record<MeasurementSource, string> = {
  SIMULATED: '⚙ sim',
  MANUAL: '✎ you',
  DEVICE: '⌚ device',
};

/** Row icon for each metric in the check-in list. */
export const METRIC_ICON: Record<HealthMetric, string> = {
  HEART_RATE: '❤️',
  SLEEP: '🛏️',
  ACTIVITY: '🏃',
  MOOD: '🙂',
  WATER: '💧',
  RADIATION: '☢️',
};

/** Mood faces for the 1–5 scale, shared by the picker and every place a mood is shown. */
export const MOODS = [
  { value: 1, face: '😞', label: 'Low' },
  { value: 2, face: '🙁', label: 'Meh' },
  { value: 3, face: '😐', label: 'Okay' },
  { value: 4, face: '🙂', label: 'Good' },
  { value: 5, face: '😄', label: 'Great' },
] as const;

/**
 * Display a reading. Mood shows as its face and word ("🙂 Good"), never "4/5",
 * which reads like progress ("one left") rather than a feeling.
 */
export function formatValue(m: Pick<HealthMeasurement, 'metric' | 'value'>): string {
  if (m.metric === 'MOOD') {
    const mood = MOODS.find((x) => x.value === Math.round(m.value));
    return mood ? `${mood.face} ${mood.label}` : String(m.value);
  }
  const def = METRICS[m.metric];
  const v = def.step < 1 ? m.value.toFixed(m.value % 1 ? 2 : 0).replace(/0$/, '') : String(m.value);
  return `${v} ${def.unit}`;
}

/** A value of `metric` rounded to its step, then formatted ("64 bpm", "7.25 h", "🙂 Good"). */
export function formatAmount(metric: HealthMetric, value: number): string {
  const step = METRICS[metric].step;
  return formatValue({ metric, value: +(Math.round(value / step) * step).toFixed(2) });
}

/** "61–66 bpm". Mood ranges are left out: a range of faces reads oddly. */
export function formatRange(metric: HealthMetric, r: UsualRange): string | null {
  if (METRICS[metric].input === 'scale') return null;
  const [lo, hi] = [formatAmount(metric, r.lo), formatAmount(metric, r.hi)];
  return lo === hi ? lo : `${lo.split(' ')[0]}–${hi}`;
}

/** How the latest day sits against the astronaut's own usual. Neutral words, no verdicts. */
export function comparisonText(metric: HealthMetric, s: Pick<MetricSummary, 'comparison' | 'usual'>): string {
  if (!s.comparison || !s.usual) return 'Your usual range appears after a few more days.';
  const range = formatRange(metric, s.usual);
  const words = { WITHIN: 'Within your usual', ABOVE: 'Higher than your usual', BELOW: 'Lower than your usual' }[s.comparison];
  return range ? `${words} (${range})` : words;
}

/** "Tue, Nov 12". */
export function dayLabel(day: string): string {
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
