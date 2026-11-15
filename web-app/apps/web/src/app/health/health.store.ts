import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  ALL_METRICS,
  GOAL_METRICS,
  GoalMetric,
  Goals,
  HabitBonus,
  HealthMeasurement,
  HealthMetric,
  MeasurementSource,
  MetricSummary,
  NewMeasurement,
  RewardOutcome,
  checkInStreak,
  dayOf,
  goalMet,
  goalTarget,
  nextMilestone,
  summarize,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from '../habitat/habitat.store';
import { HealthService, UnknownAnswer } from './health.service';
import { SimulatedWearable, WEARABLE_METRICS } from './simulated-wearable';

export interface CheckInResult {
  readings: HealthMeasurement[];
  /** Seeds for the check-in itself. */
  earned: number;
  /** Goal and streak bonuses on top. */
  bonuses: HabitBonus[];
  /** True when nothing earned only because today's seeds were already given. */
  alreadyRewarded: boolean;
}

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

  /** Swap for a real device provider later; the rest of the flow stays the same. */
  readonly wearable = new SimulatedWearable();

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
    for (const metric of ALL_METRICS) out[metric] = [];
    for (const m of this.measurements()) out[m.metric]?.push(m);
    return out;
  });

  /** Insight card per metric: the last week against the astronaut's own usual range. */
  readonly cards = computed(() => {
    const out = {} as Record<HealthMetric, MetricSummary>;
    for (const metric of ALL_METRICS) out[metric] = this.summary(metric, CARD_WINDOW_DAYS);
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
    const snap = await this.service.load();
    this.measurements.set(snap.measurements);
    this.unknowns.set(snap.unknowns ?? []);
    this.goals.set(snap.goals ?? {});
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

  /** Check-in with any subset of metrics (typed in, or read by a crew instrument). Resolves to the seeds it earned. */
  async submitManual(values: Partial<Record<HealthMetric, number>>, source: MeasurementSource = 'MANUAL'): Promise<number> {
    const measuredAt = new Date().toISOString();
    const readings: NewMeasurement[] = ALL_METRICS.filter((m) => values[m] !== undefined).map((metric) => ({
      metric,
      value: values[metric]!,
      measuredAt,
      source,
    }));
    if (!readings.length) return 0;
    await this.save(readings);
    return this.lastResult()?.earned ?? 0;
  }

  /** "I don't know" to a crew question. Resolves to the seeds it earned. */
  async answerUnknown(metric: HealthMetric): Promise<number> {
    const { earned, unknowns } = await this.service.recordUnknown(metric);
    this.unknowns.set(unknowns);
    await this.garden.credit(earned);
    return earned;
  }

  /** One metric over the last `windowDays` days (cards use a week; the detail view a week or a month). */
  summary(metric: HealthMetric, windowDays: number): MetricSummary {
    return summarize(metric, this.byMetric()[metric], windowDays, today());
  }

  async setGoal(metric: GoalMetric, value: number): Promise<void> {
    this.goals.set(await this.service.setGoal(metric, value));
  }

  async reset(): Promise<void> {
    this.service.reset();
    this.lastResult.set(null);
    this.unseen.set(false);
    await this.init();
  }

  private async save(readings: NewMeasurement[]): Promise<void> {
    const result = await this.service.record(readings);
    await this.garden.credit(result.earned + result.bonuses.reduce((sum, b) => sum + b.amount, 0));
    this.measurements.update((list) => [...list, ...result.saved]);
    this.lastResult.set({
      readings: result.saved,
      earned: result.earned,
      bonuses: result.bonuses,
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
