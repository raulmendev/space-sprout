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
  // Bump the version whenever seedGarden() changes, so saved demo gardens are replaced.
  private static readonly KEY = 'jardin-comunal:garden:v7';

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

  /** Add seeds to the balance (health check-in rewards). Returns the new balance. */
  async credit(amount: number): Promise<number> {
    const snap = await this.load();
    snap.balance += Math.max(0, Math.floor(amount));
    this.save(snap);
    return snap.balance;
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
  const ago = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();
  const longAgo = ago(24 * 3600);
  const hourAgo = ago(3600);
  /**
   * `wateredBy` set: watered an hour ago (wet soil). Omitted: thirsty (dry soil).
   * `prunedBy` set too: every need met, so the plant shines.
   */
  const mk = (itemType: string, x: number, y: number, by: Actor, wateredBy?: Actor, prunedBy?: Actor): GardenObject => ({
    id: crypto.randomUUID(),
    gardenId,
    type: 'PLANT',
    itemType,
    x,
    y,
    createdAt: longAgo,
    placedBy: by.id,
    placedByName: by.name,
    ...(wateredBy && {
      care: {
        boostMs: 0,
        lastWateredAt: hourAgo,
        ...(prunedBy && { lastPrunedAt: hourAgo }),
        log: [
          ...(prunedBy ? [{ action: 'PRUNE' as const, by: prunedBy.id, byName: prunedBy.name, at: hourAgo }] : []),
          { action: 'WATER' as const, by: wateredBy.id, byName: wateredBy.name, at: hourAgo },
        ],
      },
    }),
  });
  return {
    gardenId,
    balance: 30,
    // Every species with delivered art, fully grown, plus one rose bush per growth stage.
    objects: [
      // Top field
      mk('lily', 2, 5, LOCAL_PLAYER, FAMILY_DEMO),
      mk('rose', 5, 5, FAMILY_DEMO, LOCAL_PLAYER),
      mk('pitcher', 8, 5, LOCAL_PLAYER, FAMILY_DEMO, FAMILY_DEMO),
      mk('lettuce', 15, 5, FAMILY_DEMO),
      mk('fern', 18, 5, LOCAL_PLAYER, LOCAL_PLAYER),
      mk('nopal', 21, 5, FAMILY_DEMO, FAMILY_DEMO),
      // Bottom field
      mk('cempasuchil', 2, 11, FAMILY_DEMO, LOCAL_PLAYER),
      mk('yellowflower', 5, 11, LOCAL_PLAYER, FAMILY_DEMO, LOCAL_PLAYER),
      mk('mustard', 8, 11, FAMILY_DEMO),
      mk('monstera', 5, 13, LOCAL_PLAYER, FAMILY_DEMO, FAMILY_DEMO),
      mk('tulip', 8, 13, FAMILY_DEMO, LOCAL_PLAYER),
      // Rose bushes planted 0s, 45s, 95s and 160s ago: one per growth stage. They keep growing,
      // so all four bloom within a few minutes.
      ...[0, 45, 95, 160].map((sec, i) => ({
        ...mk('rose', 14 + 2 * i, 12, LOCAL_PLAYER, LOCAL_PLAYER),
        createdAt: ago(sec),
      })),
    ],
  };
}
