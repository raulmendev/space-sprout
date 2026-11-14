import { Injectable } from '@angular/core';
import { GardenObject, validatePlacement, getCatalogItem, PlacementError } from '@garden/shared';

export interface GardenSnapshot {
  gardenId: string;
  balance: number;
  objects: GardenObject[];
}

export type PlaceResult =
  | { ok: true; object: GardenObject; balance: number }
  | { ok: false; error: PlacementError };

/**
 * Persistence gateway. Milestone 1: localStorage.
 * Phase 2 swaps this for an HTTP implementation with the same shape; the
 * server then becomes the authority for validation and balance.
 */
@Injectable({ providedIn: 'root' })
export class GardenService {
  private static readonly KEY = 'jardin-comunal:garden:v3';

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

  async placeObject(itemType: string, x: number, y: number): Promise<PlaceResult> {
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
    };
    snap.objects.push(object);
    snap.balance -= item.price;
    this.save(snap);
    return { ok: true, object, balance: snap.balance };
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
  const mk = (itemType: string, x: number, y: number): GardenObject => ({
    id: crypto.randomUUID(),
    gardenId,
    type: 'PLANT',
    itemType,
    x,
    y,
    createdAt: longAgo,
  });
  return {
    gardenId,
    balance: 20,
    objects: [mk('tree', 2, 3), mk('flower', 5, 5), mk('sunflower', 11, 4), mk('flower', 19, 11)],
  };
}
