import type { Actor, CareAction, CareEvent, GardenObject, PlantCare } from '../types/domain';
import { getCatalogItem, matureAfterMs } from './catalog';
import { getPlantStage } from './growth';

const HOUR = 3600_000;

/**
 * Plant care economy. Coins come mainly from real-life habits; the garden pays only a little,
 * capped per person per day, so tending plants never competes with the habits it rewards.
 * Boosts are fractions of the plant's total growth time, so they scale with each species.
 */
export const CARE_RULES = {
  thirstIntervalMs: 8 * HOUR,
  fertilizeCooldownMs: 1 * HOUR,
  pruneCooldownMs: 4 * HOUR,
  waterBoost: 0.1,
  fertilizeBoost: 0.25,
  pruneBoost: 0.1,
  fertilizeCost: 2,
  waterReward: 1,
  harvestReward: 1,
  dailyGardenCoinCap: 10,
  logSize: 6,
} as const;

export type CareError = 'NOT_A_PLANT' | 'ALREADY_MATURE' | 'TOO_YOUNG' | 'NOT_MATURE' | 'COOLDOWN' | 'INSUFFICIENT_FUNDS';

export interface CareContext {
  balance: number;
  /** Garden coins this actor has already earned today. */
  earnedToday: number;
}

export interface CareCheck {
  ok: boolean;
  error?: CareError;
  /** With COOLDOWN: ms until the action is available again. */
  readyInMs?: number;
  cost: number;
  /** Coins this action would pay right now (0 once the daily cap is reached). */
  reward: number;
}

type Plant = Pick<GardenObject, 'type' | 'itemType' | 'createdAt' | 'care'>;

/** UTC day key for the daily garden-coin cap. */
export function careDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Needs water: never watered, or last watered longer ago than the thirst interval. Thirst never harms a plant. */
export function isThirsty(obj: Pick<GardenObject, 'care'>, now: number): boolean {
  const last = obj.care?.lastWateredAt;
  return !last || now - Date.parse(last) >= CARE_RULES.thirstIntervalMs;
}

/** Wants a trim: past the seed stage (seeds can't be pruned) and not pruned within the prune cooldown. */
export function needsPruning(obj: Plant, now: number): boolean {
  if (getPlantStage(obj, now) === 'SEED') return false;
  return cooldownLeft(obj.care?.lastPrunedAt, CARE_RULES.pruneCooldownMs, now) === 0;
}

/** Every need met (watered and, once it can be, pruned). Shown as a shine; a plant that isn't thriving just looks plain. */
export function isThriving(obj: Plant, now: number): boolean {
  return !isThirsty(obj, now) && !needsPruning(obj, now);
}

function cooldownLeft(lastAt: string | undefined, cooldownMs: number, now: number): number {
  return lastAt ? Math.max(0, Date.parse(lastAt) + cooldownMs - now) : 0;
}

function capped(reward: number, ctx: CareContext): number {
  return Math.max(0, Math.min(reward, CARE_RULES.dailyGardenCoinCap - ctx.earnedToday));
}

/** Whether `action` can be done on this plant now, what it costs and what it pays. */
export function checkCare(obj: Plant, action: CareAction, now: number, ctx: CareContext): CareCheck {
  const base = { cost: 0, reward: 0 };
  if (obj.type !== 'PLANT' || !getCatalogItem(obj.itemType)) return { ...base, ok: false, error: 'NOT_A_PLANT' };
  const stage = getPlantStage(obj, now);

  switch (action) {
    case 'WATER':
      // Always allowed; only a thirsty plant pays.
      return { ok: true, cost: 0, reward: isThirsty(obj, now) ? capped(CARE_RULES.waterReward, ctx) : 0 };
    case 'FERTILIZE': {
      const cost = CARE_RULES.fertilizeCost;
      if (stage === 'MATURE') return { ok: false, error: 'ALREADY_MATURE', cost, reward: 0 };
      const wait = cooldownLeft(obj.care?.lastFertilizedAt, CARE_RULES.fertilizeCooldownMs, now);
      if (wait) return { ok: false, error: 'COOLDOWN', readyInMs: wait, cost, reward: 0 };
      if (ctx.balance < cost) return { ok: false, error: 'INSUFFICIENT_FUNDS', cost, reward: 0 };
      return { ok: true, cost, reward: 0 };
    }
    case 'PRUNE': {
      if (stage === 'SEED') return { ...base, ok: false, error: 'TOO_YOUNG' };
      const wait = cooldownLeft(obj.care?.lastPrunedAt, CARE_RULES.pruneCooldownMs, now);
      if (wait) return { ...base, ok: false, error: 'COOLDOWN', readyInMs: wait };
      return { ...base, ok: true };
    }
    case 'HARVEST':
      if (stage !== 'MATURE') return { ...base, ok: false, error: 'NOT_MATURE' };
      return { ok: true, cost: 0, reward: capped(CARE_RULES.harvestReward, ctx) };
  }
}

/**
 * The plant after a water, fertilize or prune action (harvest removes the plant instead).
 * Call `checkCare` first. Growth boosts apply only while the plant is still growing.
 */
export function applyCare(obj: GardenObject, action: Exclude<CareAction, 'HARVEST'>, now: number, actor: Actor): GardenObject {
  const total = matureAfterMs(getCatalogItem(obj.itemType));
  const growing = getPlantStage(obj, now) !== 'MATURE';
  const prev: PlantCare = obj.care ?? { boostMs: 0, log: [] };
  const at = new Date(now).toISOString();
  const care: PlantCare = { ...prev };

  let boost = 0;
  if (action === 'WATER') {
    if (isThirsty(obj, now)) boost = CARE_RULES.waterBoost;
    care.lastWateredAt = at;
  } else if (action === 'FERTILIZE') {
    boost = CARE_RULES.fertilizeBoost;
    care.lastFertilizedAt = at;
  } else {
    boost = CARE_RULES.pruneBoost;
    care.lastPrunedAt = at;
  }
  if (growing) care.boostMs = prev.boostMs + Math.round(boost * total);

  const event: CareEvent = { action, by: actor.id, byName: actor.name, at };
  care.log = [event, ...prev.log].slice(0, CARE_RULES.logSize);
  return { ...obj, care };
}
