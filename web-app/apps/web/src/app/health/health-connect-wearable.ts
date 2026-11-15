import { Capacitor, registerPlugin } from '@capacitor/core';
import { HealthMetric, MeasurementProvider, NewMeasurement, validateMeasurement } from '@garden/shared';
import { WEARABLE_METRICS, simulatedValue } from './simulated-wearable';

/** What the native plugin (android/…/HealthConnectPlugin.kt) reads. A missing field = no data or no permission. */
interface HealthConnectToday {
  restingHeartRateTodayBpm?: number;
  heartRateAvgTodayBpm?: number;
  heartRateLatestBpm?: number;
  heartRateLatestTime?: string;
  sleepLast24hMinutes?: number;
  exerciseTodayMinutes?: number;
  granted: string[];
}

interface HealthConnectPlugin {
  availability(): Promise<{ status: 'AVAILABLE' | 'NEEDS_UPDATE' | 'NOT_SUPPORTED' }>;
  /** Shows Health Connect's permission dialog for whatever is missing. */
  authorize(): Promise<{ granted: string[] }>;
  readToday(): Promise<HealthConnectToday>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');

/** Only the Android app has Health Connect; the web keeps the simulated wearable. */
export const HAS_HEALTH_CONNECT = Capacitor.getPlatform() === 'android';

/** A sync that couldn't run; the message is shown at the terminal as is. */
export class WearableSyncError extends Error {}

/**
 * The phone's Health Connect data (whatever the watch or health app wrote there),
 * read the way the AstroConnect app does. Heart rate, sleep and exercise come from
 * the phone; the radiation dosimeter has no Health Connect equivalent, so it stays simulated.
 */
export class HealthConnectWearable implements MeasurementProvider {
  readonly id = 'health-connect';
  readonly label = 'Health Connect';
  readonly isSimulated = false;

  async read(): Promise<NewMeasurement[]> {
    const { status } = await HealthConnect.availability();
    if (status === 'NEEDS_UPDATE') throw new WearableSyncError('Install or update the Health Connect app, then try again.');
    if (status !== 'AVAILABLE') throw new WearableSyncError("This phone doesn't support Health Connect.");

    const { granted } = await HealthConnect.authorize();
    if (!granted.length) throw new WearableSyncError('Allow access in Health Connect to sync your readings.');

    const today = await HealthConnect.readToday();
    const measuredAt = new Date().toISOString();
    const out: NewMeasurement[] = [];
    for (const [metric, value] of Object.entries(fromHealthConnect(today)) as [HealthMetric, number][]) {
      if (WEARABLE_METRICS.includes(metric) && validateMeasurement(metric, value) === null) out.push({ metric, value, measuredAt, source: 'DEVICE' });
    }
    if (!out.length) throw new WearableSyncError('Health Connect has no heart rate, sleep or exercise for today yet. Sync your watch or health app first.');
    if (WEARABLE_METRICS.includes('RADIATION')) out.push({ metric: 'RADIATION', value: simulatedValue('RADIATION'), measuredAt, source: 'SIMULATED' });
    return out;
  }
}

/** Health Connect's figures as the game's readings. */
function fromHealthConnect(t: HealthConnectToday): Partial<Record<HealthMetric, number>> {
  const out: Partial<Record<HealthMetric, number>> = {};
  // The heart-rate card is about rest: resting rate first, else today's average, else the latest beat.
  const bpm = t.restingHeartRateTodayBpm ?? t.heartRateAvgTodayBpm ?? t.heartRateLatestBpm;
  if (bpm != null) out.HEART_RATE = Math.round(bpm);
  // Only a real night counts; no sleep recorded comes back empty, not 0 h.
  if (t.sleepLast24hMinutes) out.SLEEP = Math.round(t.sleepLast24hMinutes / 15) / 4;
  if (t.exerciseTodayMinutes != null) out.ACTIVITY = Math.round(t.exerciseTodayMinutes);
  return out;
}
