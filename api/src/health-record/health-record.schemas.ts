import { ALL_METRICS, GOAL_METRICS, type MeasurementSource } from '@garden/shared';
import { z } from 'zod';

const metric = z.enum(ALL_METRICS);
const SOURCES = ['MANUAL', 'SIMULATED', 'DEVICE'] as const satisfies readonly MeasurementSource[];

/** One health command, checked for shape here; the shared rules (`runHealth`) decide what counts and what it pays. */
export const HealthCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('READINGS'),
    readings: z.array(z.object({ metric, value: z.number(), source: z.enum(SOURCES) })).min(1).max(ALL_METRICS.length),
  }),
  z.object({ type: z.literal('UNKNOWN'), metric }),
  z.object({ type: z.literal('GOAL'), metric: z.enum(GOAL_METRICS), value: z.number() }),
]);

/** A command with the id the device gave it (the same id on a retry). */
export const SendHealthCommandSchema = z.object({ id: z.uuid(), command: HealthCommandSchema });
export type SendHealthCommand = z.infer<typeof SendHealthCommandSchema>;
