import type { HealthMetric, RewardTransaction } from '../types/domain';
import { daysBefore } from './insights';

/**
 * Daily habit goals and the check-in streak. Goals exist only where "at least X a day" is a
 * healthy habit (sleep, exercise, water); heart rate, mood and radiation never get one.
 * Reaching them pays a small seed bonus, on top of the check-in reward: coins come mainly
 * from healthy habits.
 */
export interface GoalDef {
  /** Default daily target. */
  target: number;
  min: number;
  max: number;
  step: number;
}

export const GOALS = {
  SLEEP: { target: 7, min: 5, max: 10, step: 0.5 },
  ACTIVITY: { target: 30, min: 10, max: 120, step: 5 },
  WATER: { target: 2, min: 1, max: 4, step: 0.25 },
} as const satisfies Partial<Record<HealthMetric, GoalDef>>;

export type GoalMetric = keyof typeof GOALS;
/** The astronaut's own targets; missing ones use the default. */
export type Goals = Partial<Record<GoalMetric, number>>;

export const GOAL_METRICS = Object.keys(GOALS) as GoalMetric[];

export const isGoalMetric = (m: HealthMetric): m is GoalMetric => m in GOALS;

export const HABIT_REWARD = {
  /** Seeds for reaching a goal, once per goal per day. */
  perGoal: 2,
  /** Seeds when a check-in streak reaches these lengths (days), once per streak. */
  streakMilestones: { 3: 3, 7: 5, 14: 8, 30: 12 } as Record<number, number>,
} as const;

export function goalTarget(goals: Goals, metric: GoalMetric): number {
  return goals[metric] ?? GOALS[metric].target;
}

/** A target the astronaut picked, snapped to the step and kept within sensible bounds. */
export function clampGoal(metric: GoalMetric, value: number): number {
  const { min, max, step } = GOALS[metric];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

export function goalMet(goals: Goals, metric: GoalMetric, value: number): boolean {
  return value >= goalTarget(goals, metric);
}

/** Consecutive days with a check-in, ending today (or yesterday, if today has none yet). */
export function checkInStreak(checkInDays: Iterable<string>, today: string): { length: number; start: string | null } {
  const days = new Set(checkInDays);
  let day = days.has(today) ? today : daysBefore(today, 1);
  let length = 0;
  let start: string | null = null;
  while (days.has(day)) {
    length++;
    start = day;
    day = daysBefore(day, 1);
  }
  return { length, start };
}

type Ledger = readonly Pick<RewardTransaction, 'reason' | 'ref'>[];

export interface HabitBonus {
  reason: 'GOAL' | 'STREAK';
  ref: string;
  amount: number;
  /** For the check-in message, e.g. "Water goal" or "3-day streak". */
  label: string;
}

/** Goal bonus for today's value of a goal metric, unless already paid today. */
export function decideGoalBonus(goals: Goals, metric: GoalMetric, label: string, value: number, day: string, ledger: Ledger): HabitBonus | null {
  if (!goalMet(goals, metric, value)) return null;
  const ref = `goal:${metric}:${day}`;
  if (ledger.some((r) => r.ref === ref)) return null;
  return { reason: 'GOAL', ref, amount: HABIT_REWARD.perGoal, label: `${label} goal` };
}

/** Streak bonus when the streak sits on a milestone not yet paid for this streak. */
export function decideStreakBonus(streak: { length: number; start: string | null }, ledger: Ledger): HabitBonus | null {
  const amount = HABIT_REWARD.streakMilestones[streak.length];
  if (!amount || !streak.start) return null;
  const ref = `streak:${streak.start}:${streak.length}`;
  if (ledger.some((r) => r.ref === ref)) return null;
  return { reason: 'STREAK', ref, amount, label: `${streak.length}-day streak` };
}

/** The next streak milestone above `length`, if any. */
export function nextMilestone(length: number): { days: number; amount: number } | null {
  const next = Object.keys(HABIT_REWARD.streakMilestones).map(Number).sort((a, b) => a - b).find((d) => d > length);
  return next ? { days: next, amount: HABIT_REWARD.streakMilestones[next] } : null;
}
