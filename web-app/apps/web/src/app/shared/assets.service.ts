import { Injectable, signal } from '@angular/core';
import { MANIFEST_URL, getAsset, placeholderUrl, previewTextureKey, storeItemTextureKey } from '../garden/game/asset-registry';

interface AssetManifest {
  /** Asset keys whose PNG has been delivered by the design team. */
  delivered?: string[];
}

/** Resolves asset keys to URLs: delivered PNG if listed in the manifest, else placeholder. */
@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly delivered = signal<ReadonlySet<string>>(new Set());
  /** True once the manifest has answered (or failed): until then every key looks undelivered. */
  readonly manifestLoaded = signal(false);
  readonly ready: Promise<void> = this.loadManifest();

  deliveredKeys(): string[] {
    return [...this.delivered()];
  }

  /** Whether the design team's PNG for this key has been delivered. */
  has(key: string): boolean {
    return this.delivered().has(key);
  }

  url(key: string): string {
    const asset = getAsset(key);
    return asset && this.delivered().has(key) ? asset.path : placeholderUrl(key);
  }

  /**
   * The picture on a store or inventory card: the plant's mature art for seed packets and potted
   * plants (its placeholder until delivered), else the item's own delivered art. Null: show its emoji.
   */
  itemSprite(itemId: string, plant?: string): { url: string; pixelated: boolean } | null {
    if (plant) {
      const key = previewTextureKey(plant, 'MATURE');
      return { url: this.url(key), pixelated: !this.has(key) };
    }
    const key = storeItemTextureKey(itemId);
    return this.has(key) ? { url: this.url(key), pixelated: true } : null;
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return;
      const manifest = (await res.json()) as AssetManifest;
      this.delivered.set(new Set(manifest.delivered ?? []));
    } catch {
      /* no manifest: everything uses placeholders */
    } finally {
      this.manifestLoaded.set(true);
    }
  }
}
