import type { HealthMeasurement, HealthMetric, RewardTransaction, UserRole } from '../types/domain';
import { rewardFor, unknownRewardFor } from './checkin';
import { type GoalMetric, type Goals, type HabitBonus, GOAL_METRICS, checkInStreak, clampGoal, decideGoalBonus, decideStreakBonus } from './goals';
import { METRICS, type ReadingInput, dayOf, decideReward, toMeasurement, validateMeasurement } from './health';
import { dailyValues } from './insights';
import { metricsFor } from './roles';
import type { GardenView } from './garden';

/** "I don't know" to a crew question: nothing measured, but the crew stop asking for the day. */
export interface UnknownAnswer {
  metric: HealthMetric;
  day: string;
}

/**
 * One member's health record. Private to its owner: the server keeps one per member and
 * only ever hands it to them. The rest of the station only sees the seeds it earns.
 */
export interface HealthRecord {
  measurements: HealthMeasurement[];
  /** What was paid and why (one row per reading, "don't know" or bonus), for the daily limits. */
  rewards: RewardTransaction[];
  unknowns: UnknownAnswer[];
  /** The member's own daily targets (defaults where missing). */
  goals: Goals;
}

/** The record as its owner's device sees it: everything but the reward ledger, which stays on the server. */
export type HealthView = Omit<HealthRecord, 'rewards'>;

export const emptyHealthRecord = (): HealthRecord => ({ measurements: [], rewards: [], unknowns: [], goals: {} });

/** What a member asks of their record. */
export type HealthCommand =
  | { type: 'READINGS'; readings: readonly ReadingInput[] }
  | { type: 'UNKNOWN'; metric: HealthMetric }
  | { type: 'GOAL'; metric: GoalMetric; value: number };

export interface HealthResult {
  /** Readings stored (invalid ones, or ones this role doesn't log, are skipped). */
  saved: HealthMeasurement[];
  /** Seeds for the check-in itself (or the "don't know"). */
  earned: number;
  /** Goal and streak bonuses this unlocked. */
  bonuses: HabitBonus[];
}

/** All the seeds a result pays into the station's garden. */
export const seedsOf = (r: Pick<HealthResult, 'earned' | 'bonuses'>): number => r.earned + r.bonuses.reduce((sum, b) => sum + b.amount, 0);

/** The API's answer to a health command: the result, the record as it now stands, and the garden when seeds went into it. */
export interface HealthReply {
  result: HealthResult;
  view: HealthView;
  garden?: GardenView;
}

export const viewOfHealth = ({ rewards: _ledger, ...view }: HealthRecord): HealthView => view;

/**
 * Apply one command to a member's record. Pure, like `runCommand`: the server runs it (and pays
 * the seeds into the garden in the same transaction); a device without a station runs it locally.
 */
export function runHealth(
  record: HealthRecord,
  cmd: HealthCommand,
  member: { id: string; role: UserRole },
  gardenId: string,
  now: number,
  newId: () => string,
): { record: HealthRecord; result: HealthResult } {
  const at = new Date(now).toISOString();
  const today = dayOf(at);
  const next: HealthRecord = { ...record, measurements: [...record.measurements], rewards: [...record.rewards], unknowns: [...record.unknowns] };
  const result: HealthResult = { saved: [], earned: 0, bonuses: [] };
  const pay = (measurementId: string, metric: HealthMetric, amount: number, extra: Partial<RewardTransaction> = {}) =>
    next.rewards.push({ id: newId(), gardenId, measurementId, metric, day: today, amount, createdAt: at, ...extra });

  switch (cmd.type) {
    case 'READINGS': {
      const mine = metricsFor(member.role);
      for (const input of cmd.readings) {
        if (!mine.includes(input.metric) || validateMeasurement(input.metric, input.value)) continue;
        const m = toMeasurement({ ...input, measuredAt: at }, newId(), member.id);
        const decision = decideReward(m, next.rewards, rewardFor(m.metric, m.value, member.role));
        if (decision.amount > 0) {
          pay(m.id, m.metric, decision.amount, { reason: 'CHECK_IN' });
          result.earned += decision.amount;
        }
        next.measurements.push(m);
        result.saved.push(m);
      }
      if (result.saved.length) {
        result.bonuses = habitBonuses(next, today);
        for (const b of result.bonuses) pay(b.ref, result.saved[0].metric, b.amount, { reason: b.reason, ref: b.ref }); // the ref keeps a bonus unique
      }
      break;
    }
    case 'UNKNOWN': {
      const worth = unknownRewardFor(cmd.metric, member.role);
      if (worth === null || !metricsFor(member.role).includes(cmd.metric)) break;
      if (next.unknowns.some((u) => u.metric === cmd.metric && u.day === today)) break;
      next.unknowns.push({ metric: cmd.metric, day: today });
      // One "don't know" per metric per day, so the id is stable: paying twice is impossible.
      const id = `unknown:${cmd.metric}:${today}`;
      const decision = decideReward({ id, metric: cmd.metric, measuredAt: at }, next.rewards, worth);
      if (decision.amount > 0) {
        pay(id, cmd.metric, decision.amount);
        result.earned = decision.amount;
      }
      break;
    }
    case 'GOAL':
      next.goals = { ...record.goals, [cmd.metric]: clampGoal(cmd.metric, cmd.value) };
      break;
  }
  return { record: next, result };
}

/** Goals reached today and streak milestones, each paid once (the ledger remembers). */
function habitBonuses(record: HealthRecord, today: string): HabitBonus[] {
  const bonuses: HabitBonus[] = [];
  for (const metric of GOAL_METRICS) {
    const todays = dailyValues(record.measurements.filter((m) => m.metric === metric)).find((d) => d.day === today);
    const bonus = todays && decideGoalBonus(record.goals, metric, METRICS[metric].label, todays.value, today, record.rewards);
    if (bonus) bonuses.push(bonus);
  }
  const streak = decideStreakBonus(checkInStreak(record.measurements.map((m) => dayOf(m.measuredAt)), today), record.rewards);
  if (streak) bonuses.push(streak);
  return bonuses;
}
