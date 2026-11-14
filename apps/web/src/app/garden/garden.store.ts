import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CATALOG,
  GardenObject,
  PlacementError,
  getCatalogItem,
  getPlantStage,
  getTileKind,
  msUntilMature,
  validatePlacement,
} from '@garden/shared';
import { GardenService } from './garden.service';
import { HINT_TEXTURE, plantTextureKey } from './game/plant-sprites';
import type { RenderableObject } from './game/garden.scene';
import type { TileCoord } from './game/tile-manager';

export type CloseupInfo = NonNullable<ReturnType<GardenStore['closeup']>>;

export type PlantOutcome = { ok: true; object: GardenObject } | { ok: false; error: PlacementError };

/** UI + garden state. Angular owns this; Phaser only renders what it exposes. */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly service = inject(GardenService);

  readonly catalog = CATALOG;
  readonly loaded = signal(false);
  readonly objects = signal<GardenObject[]>([]);
  readonly balance = signal(0);
  readonly selectedTile = signal<TileCoord | null>(null);
  /** Plant shown in the close-up view, if any. */
  readonly closeupId = signal<string | null>(null);

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

  /** Empty plot whose plant picker is open, if any. */
  readonly pickerTile = signal<TileCoord | null>(null);
  readonly hoverTile = signal<TileCoord | null>(null);

  /** "+" hint over an empty plot under the pointer, so plantable spots are self-evident. */
  readonly ghost = computed<RenderableObject | null>(() => {
    const tile = this.hoverTile();
    if (!tile || this.pickerTile() || this.closeupId() || !this.isEmptyPlot(tile)) return null;
    return { id: 'ghost', x: tile.x, y: tile.y, texture: HINT_TEXTURE };
  });

  /** Clock used for timestamp-based growth. */
  readonly now = signal(Date.now());

  readonly renderables = computed<RenderableObject[]>(() => {
    const now = this.now();
    return this.objects().map((o) => ({
      id: o.id,
      x: o.x,
      y: o.y,
      texture: plantTextureKey(o.itemType, getPlantStage(o, now)),
    }));
  });

  readonly selectedInfo = computed(() => {
    const tile = this.selectedTile();
    if (!tile) return null;
    const obj = this.objects().find((o) => o.x === tile.x && o.y === tile.y) ?? null;
    const now = this.now();
    return {
      tile,
      kind: getTileKind(tile.x, tile.y),
      object: obj,
      item: obj ? getCatalogItem(obj.itemType) : undefined,
      stage: obj ? getPlantStage(obj, now) : null,
      msToMature: obj ? msUntilMature(obj, now) : 0,
    };
  });

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }

  async init(): Promise<void> {
    const snap = await this.service.load();
    this.objects.set(snap.objects);
    this.balance.set(snap.balance);
    this.loaded.set(true);
  }

  isEmptyPlot(tile: TileCoord): boolean {
    return getTileKind(tile.x, tile.y) === 'SOIL' && !this.objects().some((o) => o.x === tile.x && o.y === tile.y);
  }

  canAfford(itemType: string): boolean {
    return (getCatalogItem(itemType)?.price ?? Infinity) <= this.balance();
  }

  selectTile(tile: TileCoord | null): void {
    this.selectedTile.set(tile);
  }

  /** Quick client-side check for instant feedback; the gateway re-validates. */
  previewPlacement(itemType: string, tile: TileCoord): PlacementError | null {
    return validatePlacement(itemType, tile.x, tile.y, this.objects(), this.balance());
  }

  async plant(itemType: string, tile: TileCoord): Promise<PlantOutcome> {
    const result = await this.service.placeObject(itemType, tile.x, tile.y);
    if (!result.ok) return result;
    this.objects.update((list) => [...list, result.object]);
    this.balance.set(result.balance);
    return { ok: true, object: result.object };
  }

  async resetDemo(): Promise<void> {
    this.service.reset();
    this.selectedTile.set(null);
    this.pickerTile.set(null);
    this.closeupId.set(null);
    await this.init();
  }
}
