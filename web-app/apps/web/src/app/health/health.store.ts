import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  GOAL_METRICS,
  GoalMetric,
  Goals,
  HealthMeasurement,
  HealthMetric,
  MeasurementProvider,
  MeasurementSource,
  MetricSummary,
  type HealthResult,
  type ReadingInput,
  type HealthCommand,
  type HealthView,
  type UnknownAnswer,
  checkInStreak,
  dayOf,
  goalMet,
  goalTarget,
  nextMilestone,
  seedsOf,
  summarize,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from '../habitat/habitat.store';
import { HealthService, HealthUnreachable } from './health.service';
import { SimulatedWearable, WEARABLE_METRICS } from './simulated-wearable';
import { HAS_HEALTH_CONNECT, HealthConnectWearable, WearableSyncError } from './health-connect-wearable';
import { MY_METRICS } from '../session/current-user';

/** A check-in's seeds (`earned`) and goal/streak bonuses, for the terminal. */
export type CheckInResult = Pick<HealthResult, 'earned' | 'bonuses'> & {
  /** True when nothing earned only because today's seeds were already given. */
  alreadyRewarded: boolean;
};

/** Days each insight card covers (the detail view can widen it). */
export const CARD_WINDOW_DAYS = 7;

const today = () => dayOf(new Date().toISOString());

/**
 * The astronaut's health check-ins: readings, wearable sync, rewards, and the
 * medical stations' visual states. Private to the astronaut by design.
 */
@Injectable({ providedIn: 'root' })
export class HealthStore {
  private readonly service = inject(HealthService);
  private readonly garden = inject(GardenStore);
  private readonly habitat = inject(HabitatStore);

  /** The phone's Health Connect in the Android app; a simulated wearable on the web. */
  readonly wearable: MeasurementProvider = HAS_HEALTH_CONNECT ? new HealthConnectWearable() : new SimulatedWearable();
  /** Why the last sync didn't run (no permission, no data…); cleared by the next try. */
  readonly syncError = signal<string | null>(null);

  readonly measurements = signal<HealthMeasurement[]>([]);
  /** "I don't know" answers given to the crew. */
  private readonly unknowns = signal<UnknownAnswer[]>([]);
  readonly syncing = signal(false);
  readonly lastSyncAt = signal<string | null>(null);
  readonly lastResult = signal<CheckInResult | null>(null);
  /** New readings the astronaut hasn't looked at in Health Insights yet. */
  private readonly unseen = signal(false);
  private completeTimer?: ReturnType<typeof setTimeout>;

  /** The astronaut's daily targets (defaults where not set). */
  readonly goals = signal<Goals>({});

  /** Readings per metric. */
  readonly byMetric = computed(() => {
    const out = {} as Record<HealthMetric, HealthMeasurement[]>;
    for (const metric of MY_METRICS) out[metric] = [];
    for (const m of this.measurements()) out[m.metric]?.push(m);
    return out;
  });

  /** Insight card per metric: the last week against the astronaut's own usual range. */
  readonly cards = computed(() => {
    const out = {} as Record<HealthMetric, MetricSummary>;
    for (const metric of MY_METRICS) out[metric] = this.summary(metric, CARD_WINDOW_DAYS);
    return out;
  });

  /** Consecutive days with a check-in, and the next streak bonus. */
  readonly streak = computed(() => {
    const s = checkInStreak(this.measurements().map((m) => dayOf(m.measuredAt)), today());
    return { ...s, checkedInToday: this.measurements().some((m) => dayOf(m.measuredAt) === today()), next: nextMilestone(s.length) };
  });

  /** Today's progress on each goal. */
  readonly goalProgress = computed(() =>
    GOAL_METRICS.map((metric) => {
      const value = this.today()[metric]?.value ?? null;
      const target = goalTarget(this.goals(), metric);
      return { metric, value, target, met: value !== null && goalMet(this.goals(), metric, value) };
    }),
  );

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

  /** What the crew count as answered today: a reading, or an honest "I don't know". */
  readonly answeredToday = computed(() => {
    const day = dayOf(new Date().toISOString());
    const out: Partial<Record<HealthMetric, true>> = {};
    for (const [metric, reading] of Object.entries(this.today())) if (reading) out[metric as HealthMetric] = true;
    for (const u of this.unknowns()) if (u.day === day) out[u.metric] = true;
    return out;
  });

  /** Metrics the wearable can provide; the rest (mood, water) only come from the astronaut. */
  readonly wearableMetrics = WEARABLE_METRICS;

  constructor() {
    // Health Insights: "new data" until opened, "active" while open.
    effect(() => {
      const open = this.habitat.openPanel() === 'HEALTH_INSIGHTS_SELECTED';
      if (open) untracked(() => this.unseen.set(false));
      this.habitat.propStates.HEALTH_INSIGHTS.set(open ? 'active' : this.unseen() ? 'new_data' : 'idle');
    });
  }

  async init(): Promise<void> {
    const view = await this.service.load();
    this.show(view);
    const synced = view.measurements.filter((m) => m.source !== 'MANUAL').map((m) => m.measuredAt).sort();
    this.lastSyncAt.set(synced.at(-1) ?? null);
  }

  async syncWearable(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.syncError.set(null);
    this.setTerminal('syncing');
    try {
      const readings = await this.wearable.read();
      if (await this.save(readings)) this.lastSyncAt.set(new Date().toISOString());
    } catch (e) {
      this.setTerminal('idle');
      this.syncError.set(e instanceof WearableSyncError ? e.message : "Couldn't sync. Try again in a moment.");
      if (!(e instanceof WearableSyncError)) console.error('Wearable sync failed', e);
    } finally {
      this.syncing.set(false);
    }
  }

  /** Check-in with any subset of metrics (typed in, or read by a crew instrument). Resolves to the seeds it earned. */
  async submitManual(values: Partial<Record<HealthMetric, number>>, source: MeasurementSource = 'MANUAL'): Promise<number> {
    const readings: ReadingInput[] = MY_METRICS.filter((m) => values[m] !== undefined).map((metric) => ({ metric, value: values[metric]!, source }));
    if (!readings.length) return 0;
    return (await this.save(readings))?.earned ?? 0;
  }

  /** "I don't know" to a crew question. Resolves to the seeds it earned. */
  async answerUnknown(metric: HealthMetric): Promise<number> {
    return (await this.ask({ type: 'UNKNOWN', metric }))?.earned ?? 0;
  }

  /** One metric over the last `windowDays` days (cards use a week; the detail view a week or a month). */
  summary(metric: HealthMetric, windowDays: number): MetricSummary {
    return summarize(metric, this.byMetric()[metric], windowDays, today());
  }

  async setGoal(metric: GoalMetric, value: number): Promise<void> {
    await this.ask({ type: 'GOAL', metric, value });
  }

  async reset(): Promise<void> {
    this.service.reset();
    this.lastResult.set(null);
    this.unseen.set(false);
    await this.init();
  }

  /**
   * Send a command to the player's record and show what came back: the record, and the garden with
   * the seeds it paid. Null when the station couldn't be reached (said at the terminal).
   */
  private async ask(command: HealthCommand): Promise<HealthResult | null> {
    this.syncError.set(null);
    try {
      const reply = await this.service.run(command);
      this.show(reply.view);
      await this.garden.rewarded(seedsOf(reply.result), reply.garden);
      return reply.result;
    } catch (e) {
      this.syncError.set(e instanceof HealthUnreachable ? e.message : "Couldn't save that. Try again in a moment.");
      if (!(e instanceof HealthUnreachable)) console.error('Health command failed', e);
      return null;
    }
  }

  private show(view: HealthView): void {
    this.measurements.set(view.measurements);
    this.unknowns.set(view.unknowns);
    this.goals.set(view.goals);
  }

  /** Store readings (stamped with the station's time) and show the check-in's result; null if they didn't reach it. */
  private async save(readings: readonly ReadingInput[]): Promise<HealthResult | null> {
    const result = await this.ask({ type: 'READINGS', readings });
    if (!result) {
      this.setTerminal('idle');
      return null;
    }
    this.lastResult.set({ earned: result.earned, bonuses: result.bonuses, alreadyRewarded: result.earned === 0 && result.saved.length > 0 });
    if (result.saved.length) this.unseen.set(true);
    this.setTerminal('complete');
    return result;
  }

  private setTerminal(state: 'idle' | 'syncing' | 'complete'): void {
    clearTimeout(this.completeTimer);
    this.habitat.propStates.MEDICAL_TERMINAL.set(state);
    if (state === 'complete') this.completeTimer = setTimeout(() => this.habitat.propStates.MEDICAL_TERMINAL.set('idle'), 4000);
  }
}
