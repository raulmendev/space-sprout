import Phaser from 'phaser';
import type { HabitatInteraction } from '@garden/shared';
import { HabitatRenderState, HabitatScene, RenderActor } from './habitat.scene';
import { TileCoord, TileRect, WORLD_H, WORLD_W } from './tile-manager';

/** The small surface Angular talks to. State flows in; interactions flow out. */
export interface HabitatRenderer {
  setState(state: HabitatRenderState): void;
  setActors(actors: readonly RenderActor[]): void;
  setHover(rect: TileRect | null): void;
  setSelection(rect: TileRect | null): void;
  setGhost(ghost: (TileCoord & { texture: string }) | null): void;
  flashTile(tile: TileCoord): void;
  setZoom(zoom: number): void;
  destroy(): void;
}

export interface RendererCallbacks {
  onInteraction(i: HabitatInteraction): void;
  onHover(i: HabitatInteraction | null): void;
}

/** Phaser implementation. Buffers calls until the scene is ready. */
export function createHabitatRenderer(parent: HTMLElement, deliveredKeys: readonly string[], cb: RendererCallbacks): HabitatRenderer {
  let scene: HabitatScene | null = null;
  // Calls made before the scene boots: keep only the latest of each kind.
  const latest = new Map<string, (s: HabitatScene) => void>();
  const runLatest = (key: string, fn: (s: HabitatScene) => void) => {
    if (scene) fn(scene);
    else latest.set(key, fn);
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    render: { antialias: false },
    backgroundColor: '#1d1b3a',
    scale: { mode: Phaser.Scale.NONE, width: WORLD_W, height: WORLD_H, zoom: 1 },
    banner: false,
    scene: new HabitatScene({
      deliveredKeys,
      onReady: (s) => {
        scene = s;
        latest.forEach((fn) => fn(s));
        latest.clear();
      },
      onInteraction: cb.onInteraction,
      onHover: cb.onHover,
    }),
  });

  return {
    setState: (st) => runLatest('state', (s) => s.setState(st)),
    setActors: (a) => runLatest('actors', (s) => s.setActors(a)),
    setHover: (r) => runLatest('hover', (s) => s.setHover(r)),
    setSelection: (r) => runLatest('selection', (s) => s.setSelection(r)),
    setGhost: (g) => runLatest('ghost', (s) => s.setGhost(g)),
    flashTile: (t) => scene?.flashTile(t), // a pre-boot error flash isn't worth replaying
    setZoom: (z) => game.scale.setZoom(z),
    destroy: () => game.destroy(true),
  };
}
