import Phaser from 'phaser';
import type { HabitatInteraction } from '@garden/shared';
import { GhostSprite, HabitatRenderState, HabitatScene, RenderActor } from './habitat.scene';
import { TileCoord, TileRect, WORLD_H, WORLD_W } from './tile-manager';

/** The small surface Angular talks to. State flows in; interactions flow out. */
export interface HabitatRenderer {
  setState(state: HabitatRenderState): void;
  setActors(actors: readonly RenderActor[]): void;
  setHover(rect: TileRect | null): void;
  setSelection(rect: TileRect | null): void;
  setFocus(rect: TileRect | null): void;
  setGhost(ghost: GhostSprite | null): void;
  setSpots(tiles: readonly TileCoord[] | null): void;
  flashTile(tile: TileCoord): void;
  setZoom(zoom: number): void;
  destroy(): void;
}

export interface RendererCallbacks {
  onInteraction(i: HabitatInteraction): void;
  onHover(i: HabitatInteraction | null): void;
  /** Share of the pictures loaded so far, 0–1. */
  onProgress(share: number): void;
  /** The scene is up and has been given the room (drawn on the next frame). */
  onReady(): void;
}

/** Most canvas pixels per world pixel: past this a bigger canvas costs memory without looking sharper. */
const MAX_RESOLUTION = 4;

/**
 * Phaser implementation. Buffers calls until the scene is ready.
 *
 * The canvas renders at the size it's shown on screen, in device pixels (a zoom of 1.7 on a
 * 3x phone is about 5 pixels per world pixel, capped), and the camera zooms to match. So 2x art
 * keeps its detail instead of being drawn at 1x and stretched by the browser.
 */
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
        cb.onReady();
      },
      onProgress: cb.onProgress,
      onInteraction: cb.onInteraction,
      onHover: cb.onHover,
    }),
  });

  return {
    setState: (st) => runLatest('state', (s) => s.setState(st)),
    setActors: (a) => runLatest('actors', (s) => s.setActors(a)),
    setHover: (r) => runLatest('hover', (s) => s.setHover(r)),
    setSelection: (r) => runLatest('selection', (s) => s.setSelection(r)),
    setFocus: (r) => runLatest('focus', (s) => s.setFocus(r)),
    setGhost: (g) => runLatest('ghost', (s) => s.setGhost(g)),
    setSpots: (t) => runLatest('spots', (s) => s.setSpots(t)),
    flashTile: (t) => scene?.flashTile(t), // a pre-boot error flash isn't worth replaying
    setZoom: (z) => {
      const res = Math.min(MAX_RESOLUTION, z * devicePixelRatio);
      const w = Math.round(WORLD_W * res), h = Math.round(WORLD_H * res);
      if (w !== game.scale.width || h !== game.scale.height) game.scale.resize(w, h); // skip reallocating the same size
      game.scale.setZoom(z / res); // shown at WORLD_W * z CSS pixels
      runLatest('resolution', (s) => s.setResolution(res, z));
    },
    destroy: () => game.destroy(true),
  };
}
