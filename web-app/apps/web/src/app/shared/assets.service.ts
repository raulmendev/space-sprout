import { Injectable, signal } from '@angular/core';
import { MANIFEST_URL, getAsset, placeholderUrl } from '../garden/game/asset-registry';

interface AssetManifest {
  /** Asset keys whose PNG has been delivered by the design team. */
  delivered?: string[];
}

/** Resolves asset keys to URLs: delivered PNG if listed in the manifest, else placeholder. */
@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly delivered = signal<ReadonlySet<string>>(new Set());
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

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return;
      const manifest = (await res.json()) as AssetManifest;
      this.delivered.set(new Set(manifest.delivered ?? []));
    } catch {
      /* no manifest: everything uses placeholders */
    }
  }
}
