import { Injectable } from '@angular/core';
import {
  ALL_METRICS,
  HealthMeasurement,
  HealthMetric,
  NewMeasurement,
  RewardOutcome,
  RewardTransaction,
  dayOf,
  decideReward,
  rewardFor,
  toMeasurement,
  unknownRewardFor,
  validateMeasurement,
} from '@garden/shared';
import { simulatedValue } from './simulated-wearable';

/** "I don't know" answers: nothing measured, but the crew stop asking for the day. */
export interface UnknownAnswer {
  metric: HealthMetric;
  day: string;
}

interface HealthSnapshot {
  measurements: HealthMeasurement[];
  rewards: RewardTransaction[];
  unknowns?: UnknownAnswer[];
}

export interface RecordResult {
  saved: HealthMeasurement[];
  outcomes: RewardOutcome[];
  /** Seeds granted for this batch. */
  earned: number;
}

const USER_ID = 'astronaut-demo';
const GARDEN_ID = 'garden-demo';

/**
 * Health persistence gateway. For now: localStorage, private to this browser.
 * The API version will run the same shared rules (validation + decideReward)
 * server-side, in one transaction with the balance update, and never expose
 * these records to family accounts.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private static readonly KEY = 'jardin-comunal:health:v1';

  async load(): Promise<HealthSnapshot> {
    try {
      const raw = localStorage.getItem(HealthService.KEY);
      if (raw) return JSON.parse(raw) as HealthSnapshot;
    } catch {
      /* fall through to seed */
    }
    const seeded = { measurements: seedHistory(), rewards: [] };
    this.save(seeded);
    return seeded;
  }

  /** Validate, store and reward a batch of readings. Invalid readings are skipped. */
  async record(inputs: NewMeasurement[]): Promise<RecordResult> {
    const snap = await this.load();
    const result: RecordResult = { saved: [], outcomes: [], earned: 0 };
    for (const input of inputs) {
      if (validateMeasurement(input.metric, input.value)) continue;
      const m = toMeasurement(input, crypto.randomUUID(), USER_ID);
      const decision = decideReward(m, snap.rewards, rewardFor(m.metric, m.value));
      if (decision.amount > 0) {
        snap.rewards.push({
          id: crypto.randomUUID(),
          gardenId: GARDEN_ID,
          measurementId: m.id,
          metric: m.metric,
          day: dayOf(m.measuredAt),
          amount: decision.amount,
          createdAt: new Date().toISOString(),
        });
        result.earned += decision.amount;
      }
      snap.measurements.push(m);
      result.saved.push(m);
      result.outcomes.push(decision.outcome);
    }
    this.save(snap);
    return result;
  }

  /** "I don't know" for a metric today: stored as such (never as a number), paid as the bands say. */
  async recordUnknown(metric: HealthMetric): Promise<{ earned: number; unknowns: UnknownAnswer[] }> {
    const snap = await this.load();
    const measuredAt = new Date().toISOString();
    const day = dayOf(measuredAt);
    const unknowns = (snap.unknowns ??= []);
    const worth = unknownRewardFor(metric);
    let earned = 0;
    if (worth !== null && !unknowns.some((u) => u.metric === metric && u.day === day)) {
      unknowns.push({ metric, day });
      // One "don't know" per metric per day, so the id is stable: paying twice is impossible.
      const id = `unknown:${metric}:${day}`;
      const decision = decideReward({ id, metric, measuredAt }, snap.rewards, worth);
      if (decision.amount > 0) {
        snap.rewards.push({ id: crypto.randomUUID(), gardenId: GARDEN_ID, measurementId: id, metric, day, amount: decision.amount, createdAt: measuredAt });
        earned = decision.amount;
      }
    }
    this.save(snap);
    return { earned, unknowns };
  }

  reset(): void {
    try {
      localStorage.removeItem(HealthService.KEY);
    } catch {
      /* ignore */
    }
  }

  private save(snap: HealthSnapshot): void {
    try {
      localStorage.setItem(HealthService.KEY, JSON.stringify(snap));
    } catch {
      /* storage unavailable: kept in memory for this session */
    }
  }
}

/** A week of labelled simulated history, so the trend charts have something to show in the demo. */
function seedHistory(): HealthMeasurement[] {
  let s = 7;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const out: HealthMeasurement[] = [];
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    const at = new Date(Date.now() - daysAgo * 86_400_000);
    at.setUTCHours(7, 30, 0, 0);
    for (const metric of ALL_METRICS) {
      const value = metric === 'MOOD' ? 3 + Math.round(rand() * 2) : simulatedValue(metric, rand);
      out.push(toMeasurement({ metric, value, measuredAt: at.toISOString(), source: 'SIMULATED' }, crypto.randomUUID(), USER_ID));
    }
  }
  return out;
}
