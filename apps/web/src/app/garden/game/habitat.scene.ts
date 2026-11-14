import Phaser from 'phaser';
import { HabitatInteraction, TILE_SIZE, getTileKind } from '@garden/shared';
import { WET_SOIL_TEXTURE, allAssets, getAsset } from './asset-registry';
import { missingTexture } from './placeholders';
import { TileCoord, TileManager, TileRect } from './tile-manager';

/** One sprite to draw. Computed by Angular; the scene applies no rules. */
export interface RenderSprite extends TileRect {
  id: string;
  texture: string;
  /** What clicking this sprite reports. Null = purely decorative. */
  interaction: HabitatInteraction | null;
  sway?: boolean;
  /** Gentle repeating bounce, e.g. unread notes. */
  pulse?: boolean;
  /** Animate position changes over this many ms (walking) instead of jumping. */
  moveMs?: number;
  flipX?: boolean;
  /** Tie-break within the same ground row (e.g. characters in front of plants). */
  depthBias?: number;
}

export interface HabitatRenderState {
  sprites: readonly RenderSprite[];
  /** Soil tiles to render as wet (under plants). */
  wetTiles: readonly TileCoord[];
}

export interface HabitatSceneBridge {
  /** PNG keys listed as delivered in the asset manifest. */
  deliveredKeys: readonly string[];
  onReady(scene: HabitatScene): void;
  onInteraction(interaction: HabitatInteraction): void;
  onHover(interaction: HabitatInteraction | null): void;
}

interface SpriteEntry {
  img: Phaser.GameObjects.Image;
  data: RenderSprite;
  tweens: Phaser.Tweens.Tween[];
  move?: Phaser.Tweens.Tween;
}

/** Render layers (spec §9). World objects are additionally y-sorted by footprint bottom. */
const DEPTH = { GROUND: 0, GROUND_OVERLAY: 10, WORLD: 1000, INDICATOR: 50_000, EFFECT: 60_000 } as const;

export class HabitatScene extends Phaser.Scene {
  private tiles!: TileManager;
  private readonly sprites = new Map<string, SpriteEntry>();
  private readonly wet = new Map<string, Phaser.GameObjects.Image>();
  private readonly failed = new Set<string>();
  private hover!: Phaser.GameObjects.Rectangle;
  private selection!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Image;
  private lastHover = '';
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly bridge: HabitatSceneBridge) {
    super('habitat');
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.failed.add(file.key));
    for (const key of this.bridge.deliveredKeys) {
      const asset = getAsset(key);
      if (asset) this.load.image(key, asset.path);
    }
  }

  create(): void {
    // Anything not delivered gets its placeholder; delivered-but-broken gets a loud one.
    for (const asset of allAssets()) {
      if (asset.uiOnly || this.textures.exists(asset.key)) continue;
      if (this.failed.has(asset.key)) {
        this.textures.addCanvas(asset.key, missingTexture(asset.width, asset.height));
        continue;
      }
      const out = asset.placeholder();
      if (typeof out !== 'string') this.textures.addCanvas(asset.key, out);
    }

    this.tiles = new TileManager(this);
    this.tiles.drawGround(DEPTH.GROUND);

    this.hover = this.add.rectangle(0, 0, 0, 0).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.6).setDepth(DEPTH.INDICATOR).setVisible(false);
    this.selection = this.add.rectangle(0, 0, 0, 0).setOrigin(0).setStrokeStyle(2, 0xfff3a0, 1).setDepth(DEPTH.INDICATOR + 1).setVisible(false);
    this.ghost = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setAlpha(0.6).setDepth(DEPTH.INDICATOR + 2).setVisible(false);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.selection, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.ghost, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    }

    // `over` is Phaser's own (pixel-perfect) hit test for this event; reuse it.
    this.input.on('pointermove', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const target = this.pick(p, over);
      const key = target ? hoverKey(target) : '';
      if (key === this.lastHover) return;
      this.lastHover = key;
      this.input.setDefaultCursor(target && target.type !== 'TILE_SELECTED' ? 'pointer' : 'default');
      this.bridge.onHover(target);
    });
    this.input.on('gameout', () => {
      this.lastHover = '';
      this.bridge.onHover(null);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const target = this.pick(p, over);
      if (target) this.bridge.onInteraction(target);
    });

    this.bridge.onReady(this);
  }

  /** Topmost interactive sprite under the pointer, else the tile. */
  private pick(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): HabitatInteraction | null {
    let top: Phaser.GameObjects.Image | null = null;
    for (const o of over as Phaser.GameObjects.Image[]) {
      if (o.getData('interaction') && (!top || o.depth > top.depth)) top = o;
    }
    if (top) return top.getData('interaction') as HabitatInteraction;
    const t = this.tiles.toTile(p.worldX, p.worldY);
    if (!t) return null;
    return getTileKind(t.x, t.y) === 'SOIL' ? { type: 'PLOT_SELECTED', ...t } : { type: 'TILE_SELECTED', ...t };
  }

  // ------------------------------------------------------------ renderer API

  setState(state: HabitatRenderState): void {
    const seen = new Set<string>();
    for (const data of state.sprites) {
      seen.add(data.id);
      const entry = this.sprites.get(data.id);
      if (!entry) {
        const img = this.add.image(0, 0, data.texture);
        const created: SpriteEntry = { img, data, tweens: [] };
        this.sprites.set(data.id, created);
        this.apply(created, data, null);
        this.pop(img);
      } else if (!sameSprite(entry.data, data)) {
        const prev = entry.data;
        entry.data = data;
        this.apply(entry, data, prev);
        if (prev.texture !== data.texture) this.grow(entry.img);
      }
    }
    for (const [id, entry] of this.sprites) {
      if (seen.has(id)) continue;
      entry.tweens.forEach((t) => t.remove());
      entry.img.destroy();
      this.sprites.delete(id);
    }

    const wetKeys = new Set(state.wetTiles.map((t) => `${t.x},${t.y}`));
    for (const t of state.wetTiles) {
      const k = `${t.x},${t.y}`;
      if (!this.wet.has(k)) {
        this.wet.set(k, this.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, WET_SOIL_TEXTURE).setOrigin(0).setDepth(DEPTH.GROUND_OVERLAY));
      }
    }
    for (const [k, img] of this.wet) {
      if (!wetKeys.has(k)) {
        img.destroy();
        this.wet.delete(k);
      }
    }
  }

  private apply(entry: SpriteEntry, data: RenderSprite, prev: RenderSprite | null): void {
    const { img } = entry;
    const asset = getAsset(data.texture);
    const { px, py } = this.tiles.anchor(data);
    if (!prev || prev.texture !== data.texture) img.setTexture(data.texture);
    img
      .setOrigin(asset?.originX ?? 0.5, asset?.originY ?? 1)
      .setFlipX(!!data.flipX)
      .setDepth(DEPTH.WORLD + py + (data.depthBias ?? 0));
    const moved = prev && (prev.x !== data.x || prev.y !== data.y);
    if (moved && data.moveMs && !this.reducedMotion) {
      entry.move?.remove();
      entry.move = this.tweens.add({ targets: img, x: px, y: py, duration: data.moveMs, ease: 'Linear' });
    } else if (!moved || !entry.move?.isPlaying()) {
      img.setPosition(px, py);
    }
    img.setData('interaction', data.interaction);
    if (data.interaction && !img.input) img.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
    if (!data.interaction && img.input) img.disableInteractive();

    const motionChanged = !prev || prev.sway !== data.sway || prev.pulse !== data.pulse;
    if (!motionChanged || this.reducedMotion) return;
    entry.tweens.forEach((t) => t.remove());
    entry.tweens = [];
    img.setAngle(0).setScale(1);
    if (data.sway) {
      entry.tweens.push(this.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 1500 }));
    }
    if (data.pulse) {
      entry.tweens.push(this.tweens.add({ targets: img, scaleY: 1.06, scaleX: 0.96, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1200, ease: 'Quad.out' }));
    }
  }

  setHover(rect: TileRect | null): void {
    this.placeRect(this.hover, rect);
  }

  setSelection(rect: TileRect | null): void {
    this.placeRect(this.selection, rect);
  }

  /** Translucent hint over a tile (e.g. "+" on an empty plot). */
  setGhost(ghost: (TileCoord & { texture: string }) | null): void {
    this.ghost.setVisible(!!ghost);
    if (!ghost) return;
    const { px, py } = this.tiles.anchor({ ...ghost, w: 1, h: 1 });
    this.ghost.setTexture(ghost.texture).setPosition(px, py - 4);
  }

  /** Short invalid-action feedback on a tile. */
  flashTile(tile: TileCoord): void {
    const flash = this.add.rectangle(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0xff8080, 0.4).setOrigin(0).setDepth(DEPTH.EFFECT);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
  }

  private placeRect(r: Phaser.GameObjects.Rectangle, rect: TileRect | null): void {
    r.setVisible(!!rect);
    if (rect) r.setPosition(rect.x * TILE_SIZE, rect.y * TILE_SIZE).setSize(rect.w * TILE_SIZE, rect.h * TILE_SIZE);
  }

  // ------------------------------------------------------------ decorative effects (never affect state)

  private pop(img: Phaser.GameObjects.Image): void {
    if (this.reducedMotion || !this.sys.isActive()) return;
    if (this.time.now < 500) return; // no pop for the initial load
    const s = img.scale;
    img.setScale(s * 0.2);
    this.tweens.add({ targets: img, scale: s, duration: 320, ease: 'Back.out' });
    this.sparkle(img.x, img.y - TILE_SIZE / 2);
  }

  private grow(img: Phaser.GameObjects.Image): void {
    if (this.reducedMotion) return;
    this.tweens.add({ targets: img, scaleX: 1.15, scaleY: 0.85, duration: 120, yoyo: true, ease: 'Quad.out' });
    this.sparkle(img.x, img.y - TILE_SIZE / 2);
  }

  private sparkle(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const dot = this.add.rectangle(x, y, 3, 3, i % 2 ? 0xfff3a0 : 0xffffff).setDepth(DEPTH.EFFECT);
      this.tweens.add({ targets: dot, x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, alpha: 0, duration: 450, ease: 'Quad.out', onComplete: () => dot.destroy() });
    }
  }
}

/** Cheap identity for hover de-duplication (runs on every pointer move). */
function hoverKey(i: HabitatInteraction): string {
  return 'plantId' in i ? i.plantId : 'propId' in i ? i.propId : 'x' in i ? `${i.type}:${i.x},${i.y}` : i.type;
}

/** Skip re-applying a sprite whose render data hasn't changed (most of them, every tick). */
function sameSprite(a: RenderSprite, b: RenderSprite): boolean {
  const ia = a.interaction;
  const ib = b.interaction;
  const sameInteraction = ia === ib || (!!ia && !!ib && hoverKey(ia) === hoverKey(ib));
  return (
    sameInteraction &&
    a.texture === b.texture && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h &&
    a.sway === b.sway && a.pulse === b.pulse && a.flipX === b.flipX && a.depthBias === b.depthBias && a.moveMs === b.moveMs
  );
}
