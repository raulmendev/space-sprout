import type { HealthMetric, MeasurementProvider, NewMeasurement } from '@garden/shared';

/** Plausible demo ranges; values are always labelled SIMULATED. */
const RANGES: Partial<Record<HealthMetric, [min: number, max: number, step: number]>> = {
  HEART_RATE: [58, 72, 1],
  SLEEP: [6, 8.25, 0.25],
  ACTIVITY: [55, 120, 5],
};

export function simulatedValue(metric: HealthMetric, rand: () => number = Math.random): number {
  const [min, max, step] = RANGES[metric] ?? [1, 5, 1];
  return Math.round((min + rand() * (max - min)) / step) * step;
}

/**
 * Stand-in for a real wearable (e.g. a watch via its health app). Mood is not
 * something a device can read, so it only comes from manual entry.
 */
export class SimulatedWearable implements MeasurementProvider {
  readonly id = 'simulated-wearable';
  readonly label = 'Simulated wearable';
  readonly isSimulated = true;

  async read(): Promise<NewMeasurement[]> {
    await new Promise((r) => setTimeout(r, 1400)); // feels like a sync, and shows the "syncing" state
    const measuredAt = new Date().toISOString();
    return (Object.keys(RANGES) as HealthMetric[]).map((metric) => ({
      metric,
      value: simulatedValue(metric),
      measuredAt,
      source: 'SIMULATED' as const,
    }));
  }
}
