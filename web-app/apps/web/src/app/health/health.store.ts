import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HealthMeasurement, HealthMetric, METRIC_ORDER, NewMeasurement, RewardOutcome, dayOf } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from '../habitat/habitat.store';
import { HealthService } from './health.service';
import { SimulatedWearable } from './simulated-wearable';

export interface CheckInResult {
  readings: HealthMeasurement[];
  earned: number;
  /** True when nothing earned only because today's seeds were already given. */
  alreadyRewarded: boolean;
}

/** How many past readings each trend shows. */
const TREND_LENGTH = 7;

/**
 * The astronaut's health check-ins: readings, wearable sync, rewards, and the
 * medical stations' visual states. Private to the astronaut by design.
 */
@Injectable({ providedIn: 'root' })
export class HealthStore {
  private readonly service = inject(HealthService);
  private readonly garden = inject(GardenStore);
  private readonly habitat = inject(HabitatStore);

  /** Swap for a real device provider later; the rest of the flow stays the same. */
  readonly wearable = new SimulatedWearable();

  readonly measurements = signal<HealthMeasurement[]>([]);
  readonly syncing = signal(false);
  readonly lastSyncAt = signal<string | null>(null);
  readonly lastResult = signal<CheckInResult | null>(null);
  /** New readings the astronaut hasn't looked at in Health Insights yet. */
  private readonly unseen = signal(false);
  private completeTimer?: ReturnType<typeof setTimeout>;

  /** Last readings per metric, oldest first. */
  readonly trends = computed(() => {
    const byMetric = {} as Record<HealthMetric, HealthMeasurement[]>;
    for (const metric of METRIC_ORDER) byMetric[metric] = [];
    for (const m of [...this.measurements()].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))) byMetric[m.metric]?.push(m);
    for (const metric of METRIC_ORDER) byMetric[metric] = byMetric[metric].slice(-TREND_LENGTH);
    return byMetric;
  });

  /** Today's latest reading per metric (undefined = not checked in yet today). Same day boundary as rewards. */
  readonly today = computed(() => {
    const day = dayOf(new Date().toISOString());
    const out = {} as Record<HealthMetric, HealthMeasurement | undefined>;
    for (const m of this.measurements()) {
      if (dayOf(m.measuredAt) !== day) continue;
      const prev = out[m.metric];
      if (!prev || prev.measuredAt < m.measuredAt) out[m.metric] = m;
    }
    return out;
  });

  /** Metrics the wearable can provide; the rest (mood) only come from the astronaut. */
  readonly wearableMetrics: readonly HealthMetric[] = ['HEART_RATE', 'SLEEP', 'ACTIVITY'];

  constructor() {
    // Health Insights: "new data" until opened, "active" while open.
    effect(() => {
      const open = this.habitat.openPanel() === 'HEALTH_INSIGHTS_SELECTED';
      if (open) untracked(() => this.unseen.set(false));
      this.habitat.propStates.HEALTH_INSIGHTS.set(open ? 'active' : this.unseen() ? 'new_data' : 'idle');
    });
  }

  async init(): Promise<void> {
    const snap = await this.service.load();
    this.measurements.set(snap.measurements);
    const synced = snap.measurements.filter((m) => m.source !== 'MANUAL').map((m) => m.measuredAt).sort();
    this.lastSyncAt.set(synced.at(-1) ?? null);
  }

  async syncWearable(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.setTerminal('syncing');
    try {
      const readings = await this.wearable.read();
      await this.save(readings);
      this.lastSyncAt.set(new Date().toISOString());
    } finally {
      this.syncing.set(false);
    }
  }

  /** Manual check-in with any subset of metrics. */
  async submitManual(values: Partial<Record<HealthMetric, number>>): Promise<void> {
    const measuredAt = new Date().toISOString();
    const readings: NewMeasurement[] = METRIC_ORDER.filter((m) => values[m] !== undefined).map((metric) => ({
      metric,
      value: values[metric]!,
      measuredAt,
      source: 'MANUAL',
    }));
    if (readings.length) await this.save(readings);
  }

  async reset(): Promise<void> {
    this.service.reset();
    this.lastResult.set(null);
    this.unseen.set(false);
    await this.init();
  }

  private async save(readings: NewMeasurement[]): Promise<void> {
    const result = await this.service.record(readings);
    await this.garden.credit(result.earned);
    this.measurements.update((list) => [...list, ...result.saved]);
    this.lastResult.set({
      readings: result.saved,
      earned: result.earned,
      alreadyRewarded: result.earned === 0 && result.outcomes.some((o: RewardOutcome) => o !== 'REWARDED'),
    });
    if (result.saved.length) this.unseen.set(true);
    this.setTerminal('complete');
  }

  private setTerminal(state: 'idle' | 'syncing' | 'complete'): void {
    clearTimeout(this.completeTimer);
    this.habitat.propStates.MEDICAL_TERMINAL.set(state);
    if (state === 'complete') this.completeTimer = setTimeout(() => this.habitat.propStates.MEDICAL_TERMINAL.set('idle'), 4000);
  }
}
