import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CATALOG,
  GardenObject,
  PlacementError,
  findPlacement,
  getCatalogItem,
  getPlantStage,
  getTileKind,
  msUntilMature,
  objectAtTile,
  propAtTile,
} from '@garden/shared';
import { GardenService } from './garden.service';
import type { TileCoord } from './game/tile-manager';

export type CloseupInfo = NonNullable<ReturnType<GardenStore['closeup']>>;
export type PlantOutcome = { ok: true; object: GardenObject } | { ok: false; error: PlacementError };

/** Garden domain state: plants, balance, growth clock. */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly service = inject(GardenService);

  readonly catalog = CATALOG;
  readonly objects = signal<GardenObject[]>([]);
  readonly balance = signal(0);
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
    const ageMs = now - Date.parse(obj.createdAt);
    const total = item.growth?.matureAfterMs ?? 0;
    return {
      object: obj,
      item,
      stage: getPlantStage(obj, now),
      progress: total ? Math.min(1, ageMs / total) : 1,
      msToMature: msUntilMature(obj, now),
      ageMs,
    };
  });

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }

  async init(): Promise<void> {
    const snap = await this.service.load();
    this.objects.set(snap.objects);
    this.balance.set(snap.balance);
  }

  plantAt(tile: TileCoord): GardenObject | undefined {
    return objectAtTile(this.objects(), tile.x, tile.y);
  }

  isEmptyPlot(tile: TileCoord): boolean {
    return getTileKind(tile.x, tile.y) === 'SOIL' && !this.plantAt(tile) && !propAtTile(tile.x, tile.y);
  }

  /** Where `itemType` would go if planted around `tile`, or why it can't. */
  placementFor(itemType: string, tile: TileCoord) {
    return findPlacement(itemType, tile.x, tile.y, this.objects(), this.balance());
  }

  async plant(itemType: string, tile: TileCoord): Promise<PlantOutcome> {
    const spot = this.placementFor(itemType, tile);
    if (!spot.ok) return spot;
    const result = await this.service.placeObject(itemType, spot.x, spot.y);
    if (!result.ok) return result;
    this.objects.update((list) => [...list, result.object]);
    this.balance.set(result.balance);
    return { ok: true, object: result.object };
  }

  async resetDemo(): Promise<void> {
    this.service.reset();
    this.pickerTile.set(null);
    this.closeupId.set(null);
    await this.init();
  }
}
