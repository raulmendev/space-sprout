import { Injectable } from '@angular/core';
import {
  Actor,
  CareAction,
  CareError,
  GardenObject,
  PlacementError,
  applyCare,
  careDay,
  checkCare,
  getCatalogItem,
  validatePlacement,
} from '@garden/shared';

/** Garden coins earned per actor on one day, for the daily cap. */
export type GardenEarnings = Record<string, { day: string; amount: number }>;

export interface GardenSnapshot {
  gardenId: string;
  balance: number;
  objects: GardenObject[];
  earnings?: GardenEarnings;
}

export type PlaceResult =
  | { ok: true; object: GardenObject; balance: number }
  | { ok: false; error: PlacementError };

export type CareResult =
  | { ok: true; object: GardenObject | null; balance: number; earned: number; earnedToday: number }
  | { ok: false; error: CareError | 'NOT_FOUND' };

/**
 * Who is playing on this device. Until accounts exist, the local player is the astronaut;
 * the family's actions arrive through the same shared garden once there is a backend.
 */
export const LOCAL_PLAYER: Actor = { id: 'astronaut-demo', name: 'Astronaut' };
const FAMILY_DEMO: Actor = { id: 'family-demo', name: 'Family' };

export function earnedToday(earnings: GardenEarnings | undefined, actorId: string, now: number): number {
  const e = earnings?.[actorId];
  return e && e.day === careDay(now) ? e.amount : 0;
}

/**
 * Persistence gateway. Milestone 1: localStorage.
 * Phase 2 swaps this for an HTTP implementation with the same shape; the
 * server then becomes the authority for validation and balance.
 */
@Injectable({ providedIn: 'root' })
export class GardenService {
  private static readonly KEY = 'jardin-comunal:garden:v4';

  async load(): Promise<GardenSnapshot> {
    try {
      const raw = localStorage.getItem(GardenService.KEY);
      if (raw) return JSON.parse(raw) as GardenSnapshot;
    } catch {
      /* fall through to seed */
    }
    const seeded = seedGarden();
    this.save(seeded);
    return seeded;
  }

  async placeObject(itemType: string, x: number, y: number, actor: Actor = LOCAL_PLAYER): Promise<PlaceResult> {
    const snap = await this.load();
    const error = validatePlacement(itemType, x, y, snap.objects, snap.balance);
    if (error) return { ok: false, error };
    const item = getCatalogItem(itemType)!;
    const object: GardenObject = {
      id: crypto.randomUUID(),
      gardenId: snap.gardenId,
      type: item.type,
      itemType,
      x,
      y,
      createdAt: new Date().toISOString(),
      placedBy: actor.id,
      placedByName: actor.name,
    };
    snap.objects.push(object);
    snap.balance -= item.price;
    this.save(snap);
    return { ok: true, object, balance: snap.balance };
  }

  /** Water, fertilize, prune or harvest a plant. Harvest removes it and frees the plot (`object: null`). */
  async care(plantId: string, action: CareAction, actor: Actor = LOCAL_PLAYER): Promise<CareResult> {
    const snap = await this.load();
    const idx = snap.objects.findIndex((o) => o.id === plantId);
    if (idx < 0) return { ok: false, error: 'NOT_FOUND' };
    const now = Date.now();
    const already = earnedToday(snap.earnings, actor.id, now);
    const check = checkCare(snap.objects[idx], action, now, { balance: snap.balance, earnedToday: already });
    if (!check.ok) return { ok: false, error: check.error! };

    let object: GardenObject | null = null;
    if (action === 'HARVEST') snap.objects.splice(idx, 1);
    else snap.objects[idx] = object = applyCare(snap.objects[idx], action, now, actor);

    snap.balance += check.reward - check.cost;
    const total = already + check.reward;
    snap.earnings = { ...snap.earnings, [actor.id]: { day: careDay(now), amount: total } };
    this.save(snap);
    return { ok: true, object, balance: snap.balance, earned: check.reward, earnedToday: total };
  }

  /** Demo helper: wipe local garden back to the seeded state. */
  reset(): void {
    try {
      localStorage.removeItem(GardenService.KEY);
    } catch {
      /* ignore */
    }
  }

  private save(snap: GardenSnapshot): void {
    try {
      localStorage.setItem(GardenService.KEY, JSON.stringify(snap));
    } catch {
      /* storage unavailable: state stays in memory for this session */
    }
  }
}

function seedGarden(): GardenSnapshot {
  const gardenId = 'garden-demo';
  const longAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const mk = (itemType: string, x: number, y: number, by: Actor): GardenObject => ({
    id: crypto.randomUUID(),
    gardenId,
    type: 'PLANT',
    itemType,
    x,
    y,
    createdAt: longAgo,
    placedBy: by.id,
    placedByName: by.name,
  });
  return {
    gardenId,
    balance: 20,
    objects: [
      mk('tree', 3, 3, LOCAL_PLAYER),
      mk('flower', 7, 5, FAMILY_DEMO),
      mk('sunflower', 15, 4, FAMILY_DEMO),
      mk('flower', 19, 11, LOCAL_PLAYER),
    ],
  };
}
