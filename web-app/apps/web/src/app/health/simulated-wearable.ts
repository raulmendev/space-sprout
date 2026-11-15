import type { HealthMetric, MeasurementProvider, NewMeasurement } from '@garden/shared';

/** Plausible demo ranges (also used for the seeded history); values are always labelled SIMULATED. */
const RANGES: Partial<Record<HealthMetric, [min: number, max: number, step: number]>> = {
  HEART_RATE: [58, 72, 1],
  SLEEP: [6, 8.25, 0.25],
  ACTIVITY: [55, 120, 5],
  WATER: [1.5, 3, 0.25],
  RADIATION: [0.35, 1.1, 0.01],
  // Not read by the wearable; used for the demo history and the scientist's scan.
  BODY_TEMP: [36.3, 37.1, 0.1],
  STRESS: [2, 3, 1],
  CALORIES: [2200, 2800, 50],
  CO2: [1800, 5400, 10],
};

/** What the wearable (watch + personal dosimeter) can read. Mood and water only come from the astronaut. */
export const WEARABLE_METRICS: readonly HealthMetric[] = ['HEART_RATE', 'SLEEP', 'ACTIVITY', 'RADIATION'];

export function simulatedValue(metric: HealthMetric, rand: () => number = Math.random): number {
  const [min, max, step] = RANGES[metric] ?? [1, 5, 1];
  // Round to the step, then clear float noise (0.62000001).
  return +(Math.round((min + rand() * (max - min)) / step) * step).toFixed(2);
}

/**
 * Stand-in for a real wearable (a watch via its health app, plus the personal
 * dosimeter). Mood and water are not something a device can read, so they
 * only come from manual entry.
 */
export class SimulatedWearable implements MeasurementProvider {
  readonly id = 'simulated-wearable';
  readonly label = 'Simulated wearable';
  readonly isSimulated = true;

  async read(): Promise<NewMeasurement[]> {
    await new Promise((r) => setTimeout(r, 1400)); // feels like a sync, and shows the "syncing" state
    const measuredAt = new Date().toISOString();
    return WEARABLE_METRICS.map((metric) => ({
      metric,
      value: simulatedValue(metric),
      measuredAt,
      source: 'SIMULATED' as const,
    }));
  }
}
