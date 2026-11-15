import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CARE_RULES,
  CATALOG,
  CareAction,
  FERTILIZER,
  GARDEN_ROOM,
  GardenObject,
  Inventory,
  SocialNote,
  PlacementError,
  Purchase,
  PurchaseError,
  owned,
  seedItemId,
  findPlacement,
  getCatalogItem,
  checkCare,
  getPlantStage,
  isThriving,
  matureAfterMs,
  getTileKind,
  growthAgeMs,
  isThirsty,
  msUntilMature,
  objectAtTile,
  propAtTile,
} from '@garden/shared';
import { CareResult, GardenService, LOCAL_PLAYER, PostNoteResult, earnedToday } from './garden.service';
import type { TileCoord } from './game/tile-manager';

export type CloseupInfo = NonNullable<ReturnType<GardenStore['closeup']>>;
export type PlantOutcome = { ok: true; object: GardenObject } | { ok: false; error: PlacementError };

/** Garden domain state: plants, balance, the shared inventory, growth clock. */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly service = inject(GardenService);

  readonly catalog = CATALOG;
  readonly objects = signal<GardenObject[]>([]);
  readonly balance = signal(0);
  /** Shared household inventory: seed packets, fertilizer, decorations. */
  readonly inventory = signal<Inventory>({});
  /** Recent store purchases (anyone in the household), newest first. */
  readonly purchases = signal<Purchase[]>([]);
  /** Notes pinned from this device (see NotesStore for the whole board). */
  readonly notes = signal<SocialNote[]>([]);
  /** Clock used for timestamp-based growth. */
  readonly now = signal(Date.now());

  /** Plant shown in the close-up view, if any. */
  readonly closeupId = signal<string | null>(null);
  /** Empty plot whose plant picker is open, if any. */
  readonly pickerTile = signal<TileCoord | null>(null);

  readonly closeup = computed(() => {
    const obj = this.objects().find((o) => o.id === this.closeupId());
    const item = obj && getCatalogItem(obj.itemType);
    if (!obj || !item) return null;
    const now = this.now();
    const total = matureAfterMs(item);
    const fertilizer = owned(this.inventory(), FERTILIZER);
    const ctx = { fertilizer, earnedToday: this.earnedToday() };
    const check = (a: CareAction) => checkCare(obj, a, now, ctx);
    return {
      object: obj,
      item,
      stage: getPlantStage(obj, now),
      progress: total ? Math.min(1, growthAgeMs(obj, now) / total) : 1,
      msToMature: msUntilMature(obj, now),
      ageMs: now - Date.parse(obj.createdAt),
      thirsty: isThirsty(obj, now),
      thriving: isThriving(obj, now),
      actions: { WATER: check('WATER'), FERTILIZE: check('FERTILIZE'), PRUNE: check('PRUNE'), HARVEST: check('HARVEST') },
      fertilizer,
      log: obj.care?.log ?? [],
      me: LOCAL_PLAYER.id,
      capReached: ctx.earnedToday >= CARE_RULES.dailyGardenCoinCap,
    };
  });

  /** Garden coins the local player has earned today (capped daily). */
  readonly earnedToday = signal(0);

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }

  async init(): Promise<void> {
    const snap = await this.service.load();
    this.objects.set(snap.objects);
    this.balance.set(snap.balance);
    this.inventory.set(snap.inventory);
    this.purchases.set(snap.purchases);
    this.notes.set(snap.notes ?? []);
    this.earnedToday.set(earnedToday(snap.earnings, LOCAL_PLAYER.id, Date.now()));
  }

  async postNote(content: string): Promise<PostNoteResult> {
    const result = await this.service.postNote(content);
    if (result.ok) {
      this.inventory.set(result.inventory);
      this.notes.update((list) => [...list, result.note]);
    }
    return result;
  }

  async takeDownNote(noteId: string): Promise<boolean> {
    const ok = await this.service.takeDownNote(noteId);
    if (ok) this.notes.update((list) => list.filter((n) => n.id !== noteId));
    return ok;
  }

  async care(plantId: string, action: CareAction): Promise<CareResult> {
    const result = await this.service.care(plantId, action);
    if (!result.ok) return result;
    const updated = result.object;
    this.objects.update((list) =>
      updated ? list.map((o) => (o.id === plantId ? updated : o)) : list.filter((o) => o.id !== plantId),
    );
    this.balance.set(result.balance);
    this.inventory.set(result.inventory);
    this.earnedToday.set(result.earnedToday);
    this.now.set(Date.now());
    if (!updated) this.closeupId.set(null);
    return result;
  }

  plantAt(tile: TileCoord): GardenObject | undefined {
    return objectAtTile(this.objects(), tile.x, tile.y);
  }

  isEmptyPlot(tile: TileCoord): boolean {
    return getTileKind(GARDEN_ROOM, tile.x, tile.y) === 'SOIL' && !this.plantAt(tile) && !propAtTile(GARDEN_ROOM, tile.x, tile.y);
  }

  /** Where `itemType` would go if planted around `tile`, or why it can't. */
  placementFor(itemType: string, tile: TileCoord) {
    return findPlacement(itemType, tile.x, tile.y, this.objects(), owned(this.inventory(), seedItemId(itemType)));
  }

  async plant(itemType: string, tile: TileCoord): Promise<PlantOutcome> {
    const spot = this.placementFor(itemType, tile);
    if (!spot.ok) return spot;
    const result = await this.service.placeObject(itemType, spot.x, spot.y);
    if (!result.ok) return result;
    this.objects.update((list) => [...list, result.object]);
    this.inventory.set(result.inventory);
    return { ok: true, object: result.object };
  }

  /** Buy one of a store item into the shared inventory. */
  async buy(itemId: string): Promise<PurchaseError | null> {
    const result = await this.service.buy(itemId);
    if (!result.ok) return result.error;
    this.balance.set(result.balance);
    this.inventory.set(result.inventory);
    this.purchases.set(result.purchases);
    return null;
  }

  /** Credit seeds earned elsewhere (health check-ins). */
  async credit(amount: number): Promise<void> {
    if (amount > 0) this.balance.set(await this.service.credit(amount));
  }

  async resetDemo(): Promise<void> {
    this.service.reset();
    this.pickerTile.set(null);
    this.closeupId.set(null);
    await this.init();
  }
}
