import Phaser from 'phaser';
import { HabitatInteraction, RoomId, TILE_SIZE, getTileKind } from '@garden/shared';
import { GROUND_SHADOW_TEXTURE, ROOM_WINDOWS, RoomWindows, TWINKLE_TEXTURE, WET_SOIL_TEXTURE, allAssets, getAsset, roomTextureKey } from './asset-registry';
import { missingTexture } from './placeholders';
import { TileCoord, TileManager, TileRect, WORLD_H, WORLD_W, fitToGame, restingScale, restingSize } from './tile-manager';

/** One sprite to draw. Computed by Angular; the scene applies no rules. */
export interface RenderSprite extends TileRect {
  id: string;
  texture: string;
  /** What clicking this sprite reports. Null = purely decorative. */
  interaction: HabitatInteraction | null;
  sway?: boolean;
  /** Gentle repeating bounce, e.g. unread notes. */
  pulse?: boolean;
  /** Small icon floating above the sprite (e.g. the thirst bubble). Clicking it acts like clicking the sprite. */
  badge?: string;
  /** Where the badge's bottom-centre sits, in pixels from the sprite's top-left. Default: centred on top. */
  badgeAt?: { dx: number; dy: number };
  /** Soft twinkles around the sprite (a plant with every need met). */
  shine?: boolean;
  /** Lies flat on the floor (a rug): drawn under characters and everything standing. */
  flat?: boolean;
  /** Small images pinned on the sprite (notes on the message board). Taps go through to the sprite. */
  decals?: readonly RenderDecal[];
}

/** A decal's centre, in pixels from the sprite's top-left corner, and its tilt in degrees. */
export interface RenderDecal {
  texture: string;
  dx: number;
  dy: number;
  angle?: number;
  /** Rocks gently around its bottom edge, like a grown plant in the garden (a potted plant). */
  sway?: boolean;
}

/** A moving character. Position is a continuous point (tile units) at its feet. */
export interface RenderActor {
  id: string;
  texture: string;
  x: number;
  y: number;
  flipX: boolean;
  moving: boolean;
  interaction: HabitatInteraction | null;
  /** Frame-by-frame art (the astronaut). Without it the texture is still, flipped and bobbed. */
  anim?: ActorAnim;
  /** Hovers (the crew robots): drifts gently up and down all the time over a small shadow, instead of the walk bob. */
  float?: boolean;
  /** Stands on the floor (the astronaut): a contact shadow under its feet, like the furniture's. */
  shadow?: boolean;
}

/** Frames played by the scene's own clock, so they keep going while nothing else changes. */
export interface ActorAnim {
  frames: readonly string[];
  fps: number;
  /** Loops forever (walking) or holds the last frame (a wave). */
  loop: boolean;
  /** performance.now() when it started: frame 0 is shown at this moment. */
  startedAt: number;
}

/** Feet sit a little below the foot point so characters look planted on the floor. */
const FOOT_OFFSET_PX = 6;
/** Characters draw in front of props/plants whose base is on the same line. */
const ACTOR_DEPTH_BIAS = 0.5;
/** Hovering robots: always `lift` px up, drifting `amplitude` px more and back every `periodMs`. */
const FLOAT = { lift: 3, amplitude: 3, periodMs: 1800 } as const;

interface FloatState {
  /** Where the feet would be on the floor (px). */
  baseY: number;
  /** Each robot drifts on its own beat. */
  phase: number;
}

/** A stable phase (radians) from an id, so robots don't bob in step. */
function phaseOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h >>> 0) % 1000) / 1000 * 2 * Math.PI;
}

/** A translucent preview sprite over a footprint, raised `lift` px (the "+" hint floats a little). */
export interface GhostSprite extends TileRect {
  texture: string;
  lift: number;
}

export interface HabitatRenderState {
  /** The room to show. Changing it rebuilds the scene behind a short fade. */
  room: RoomId;
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
  badge?: Phaser.GameObjects.Image;
  badgeBob?: Phaser.Tweens.Tween;
  shine?: { stars: Phaser.GameObjects.Image[]; glow: Phaser.GameObjects.Ellipse; tweens: Phaser.Tweens.Tween[] };
  decals: Phaser.GameObjects.Image[];
}

/** Render layers (spec §9). World objects are additionally y-sorted by footprint bottom. */
const DEPTH = { GROUND: 0, GROUND_OVERLAY: 10, WORLD: 1000, INDICATOR: 50_000, EFFECT: 60_000 } as const;

export class HabitatScene extends Phaser.Scene {
  private tiles!: TileManager;
  private readonly sprites = new Map<string, SpriteEntry>();
  private readonly wet = new Map<string, Phaser.GameObjects.Image>();
  private readonly actors = new Map<string, Phaser.GameObjects.Image>();
  /** The shadow under each character: a small oval under a hovering one, the furniture's contact shadow under one standing. */
  private readonly shadows = new Map<string, Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image>();
  /** The latest characters sent, kept for when a room change held them back. */
  private lastActors: readonly RenderActor[] = [];
  private readonly failed = new Set<string>();
  private room: RoomId | null = null;
  private ground: Phaser.GameObjects.Image[] = [];
  /** The room's animated windows, part of its ground; null when it has none. */
  private windows: { img: Phaser.GameObjects.Image; anim: RoomWindows } | null = null;
  /** While fading between rooms, the latest state waits here. */
  private queued: HabitatRenderState | null = null;
  private building = false;
  private hover!: Phaser.GameObjects.Rectangle;
  private selection!: Phaser.GameObjects.Rectangle;
  private focus!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Image;
  /** While placing a decoration: the tiles it can go on, lit up. Taps then always mean "this tile". */
  private spots: Phaser.GameObjects.Rectangle[] | null = null;
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
      const out = asset.placeholder?.();
      if (out && typeof out !== 'string') this.textures.addCanvas(asset.key, out);
    }

    this.tiles = new TileManager(this);

    this.hover = this.add.rectangle(0, 0, 0, 0).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.6).setDepth(DEPTH.INDICATOR).setVisible(false);
    this.selection = this.add.rectangle(0, 0, 0, 0).setOrigin(0).setStrokeStyle(2, 0xfff3a0, 1).setDepth(DEPTH.INDICATOR + 1).setVisible(false);
    this.focus = this.add.rectangle(0, 0, 0, 0).setOrigin(0).setStrokeStyle(2, 0x9cf29c, 0.95).setDepth(DEPTH.INDICATOR - 1).setVisible(false);
    this.ghost = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setAlpha(0.6).setDepth(DEPTH.INDICATOR + 2).setVisible(false);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.selection, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.ghost, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.focus, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
    }

    // `over` is Phaser's own (pixel-perfect) hit test for this event; reuse it.
    this.input.on('pointermove', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const target = this.pick(p, over);
      const key = target ? hoverKey(target) : '';
      if (key === this.lastHover) return;
      this.lastHover = key;
      this.input.setDefaultCursor(this.spots ? 'crosshair' : target && target.type !== 'TILE_SELECTED' ? 'pointer' : 'default');
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
    if (this.spots) {
      const t = this.tiles.toTile(p.worldX, p.worldY);
      return t ? { type: 'TILE_SELECTED', ...t } : null;
    }
    let top: Phaser.GameObjects.Image | null = null;
    for (const o of over as Phaser.GameObjects.Image[]) {
      if (o.getData('interaction') && (!top || o.depth > top.depth)) top = o;
    }
    if (top) return top.getData('interaction') as HabitatInteraction;
    const t = this.tiles.toTile(p.worldX, p.worldY);
    if (!t) return null;
    return this.room && getTileKind(this.room, t.x, t.y) === 'SOIL' ? { type: 'PLOT_SELECTED', ...t } : { type: 'TILE_SELECTED', ...t };
  }

  // ------------------------------------------------------------ renderer API

  /** The canvas renders `pixelsPerUnit` pixels per world pixel: zoom the camera to fill it with the room. */
  setResolution(pixelsPerUnit: number): void {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height).setZoom(pixelsPerUnit).centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  setState(state: HabitatRenderState): void {
    if (this.queued) {
      this.queued = state; // mid-fade: apply once the new room is up
      return;
    }
    if (state.room === this.room) return this.applyState(state);
    if (this.room === null || this.reducedMotion) return this.enterRoom(state);
    this.queued = state;
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const next = this.queued!;
      this.queued = null;
      this.enterRoom(next);
      cam.fadeIn(180);
    });
    cam.fadeOut(140, 29, 27, 58);
  }

  /** Tear down the current room and draw the new one (no pop effects for what was already there). */
  private enterRoom(state: HabitatRenderState): void {
    this.ground.forEach((g) => g.destroy());
    this.wet.forEach((w) => w.destroy());
    this.wet.clear();
    for (const entry of this.sprites.values()) {
      entry.tweens.forEach((t) => t.remove());
      this.removeBadge(entry, false);
      this.removeShine(entry);
      this.removeDecals(entry);
      entry.img.destroy();
    }
    this.sprites.clear();
    this.actors.forEach((a) => a.destroy());
    this.actors.clear();
    this.shadows.forEach((s) => s.destroy());
    this.shadows.clear();
    this.room = state.room;
    this.ground = this.tiles.drawGround(state.room, DEPTH.GROUND);
    this.windows = this.drawWindows(state.room);
    if (this.windows) this.ground.push(this.windows.img);
    this.building = true;
    this.applyState(state);
    this.building = false;
    // Characters sent during the fade were held back: draw them now, in their latest pose.
    // (Standing still sends nothing new, so waiting for "the next update" could freeze a walk frame.)
    this.setActors(this.lastActors);
  }

  private applyState(state: HabitatRenderState): void {
    const seen = new Set<string>();
    for (const data of state.sprites) {
      seen.add(data.id);
      const entry = this.sprites.get(data.id);
      if (!entry) {
        const img = fitToGame(this.add.image(0, 0, data.texture));
        const created: SpriteEntry = { img, data, tweens: [], decals: [] };
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
      this.removeBadge(entry, false);
      this.removeShine(entry);
      this.removeDecals(entry);
      entry.img.destroy();
      this.sprites.delete(id);
    }

    const wetKeys = new Set(state.wetTiles.map((t) => `${t.x},${t.y}`));
    for (const t of state.wetTiles) {
      const k = `${t.x},${t.y}`;
      if (!this.wet.has(k)) {
        // Translucent: it darkens the soil under it, painted room or tiles alike.
        this.wet.set(k, this.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, WET_SOIL_TEXTURE).setOrigin(0).setAlpha(0.5).setDepth(DEPTH.GROUND_OVERLAY));
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
    if (!prev || prev.texture !== data.texture) fitToGame(img.setTexture(data.texture));
    img
      .setOrigin(asset?.originX ?? 0.5, asset?.originY ?? 1)
      .setPosition(px, py)
      .setDepth(data.flat ? DEPTH.GROUND_OVERLAY + 2 : DEPTH.WORLD + py);
    img.setData('interaction', data.interaction);
    if (data.interaction && !img.input) img.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
    if (!data.interaction && img.input) img.disableInteractive();
    this.applyBadge(entry, data, prev);
    this.applyShine(entry, data, prev);
    this.applyDecals(entry, data, prev);

    const motionChanged = !prev || prev.sway !== data.sway || prev.pulse !== data.pulse;
    if (!motionChanged || this.reducedMotion) return;
    entry.tweens.forEach((t) => t.remove());
    entry.tweens = [];
    fitToGame(img.setAngle(0));
    const s = restingScale(img);
    if (data.sway) {
      entry.tweens.push(this.sway(img));
    }
    if (data.pulse) {
      entry.tweens.push(this.tweens.add({ targets: img, scaleY: s * 1.06, scaleX: s * 0.96, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1200, ease: 'Quad.out' }));
    }
  }

  /** Place characters for this frame. Cheap: no tweens, just positions. */
  setActors(actors: readonly RenderActor[]): void {
    this.lastActors = actors;
    if (this.queued || !this.room) return; // mid room change: enterRoom draws the latest
    const seen = new Set<string>();
    const shadowed = new Set<string>();
    const bob = this.reducedMotion ? 0 : Math.abs(Math.sin(this.time.now / 90)) * 2;
    for (const a of actors) {
      seen.add(a.id);
      let img = this.actors.get(a.id);
      if (!img) {
        const asset = getAsset(a.texture);
        img = fitToGame(this.add.image(0, 0, a.texture)).setOrigin(asset?.originX ?? 0.5, asset?.originY ?? 1);
        if (a.interaction) img.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
        this.actors.set(a.id, img);
      }
      const px = a.x * TILE_SIZE;
      const py = a.y * TILE_SIZE + FOOT_OFFSET_PX;
      const float: FloatState | null = a.float ? { baseY: py, phase: phaseOf(a.id) } : null;
      img
        // Animated art walks on its own and hovering robots drift; only the rest get the walk bob. Animated art isn't mirrored.
        .setPosition(px, py - (a.moving && !a.anim && !a.float ? bob : 0))
        .setFlipX(a.anim ? false : a.flipX)
        .setDepth(DEPTH.WORLD + py + ACTOR_DEPTH_BIAS)
        .setData('interaction', a.interaction)
        .setData('anim', a.anim ?? null)
        .setData('float', float);
      if (!a.anim && img.texture.key !== a.texture) img.setTexture(a.texture); // e.g. crew art that turns
      if (float || a.shadow) {
        this.placeShadow(a.id, img, px, py, !float);
        shadowed.add(a.id);
      }
      this.showFrame(img);
      this.applyHover(a.id, img);
    }
    for (const [id, img] of this.actors) {
      if (!seen.has(id)) {
        img.destroy();
        this.actors.delete(id);
      }
    }
    for (const [id, shadow] of this.shadows) {
      if (!shadowed.has(id)) {
        shadow.destroy();
        this.shadows.delete(id);
      }
    }
  }

  /** Phaser's per-frame hook: advance every animated character and keep the robots hovering. */
  override update(): void {
    for (const [id, img] of this.actors) {
      this.showFrame(img);
      this.applyHover(id, img);
    }
    this.animateWindows();
  }

  /** The sky in the room's windows, over its picture (only when both were delivered). */
  private drawWindows(room: RoomId): { img: Phaser.GameObjects.Image; anim: RoomWindows } | null {
    const anim = ROOM_WINDOWS[room];
    if (!anim || ![roomTextureKey(room), ...anim.frames].every((k) => this.textures.exists(k))) return null;
    const img = fitToGame(this.add.image(anim.at[0], anim.at[1], anim.frames[0])).setOrigin(0).setDepth(DEPTH.GROUND + 1);
    return { img, anim };
  }

  /** Next window frame when its time comes. Reduced motion: the first frame stays. */
  private animateWindows(): void {
    if (!this.windows || this.reducedMotion) return;
    const { img, anim } = this.windows;
    const key = anim.frames[Math.floor(this.time.now / anim.frameMs) % anim.frames.length];
    if (img.texture.key !== key) img.setTexture(key);
  }

  /**
   * The shadow on the floor, just behind the character. Hovering: a soft oval about half as wide as
   * it. Standing: the furniture's contact shadow under its feet, which stays put through the walk bob.
   */
  private placeShadow(id: string, img: Phaser.GameObjects.Image, px: number, py: number, ground: boolean): void {
    let shadow = this.shadows.get(id);
    if (!shadow) {
      shadow = ground
        ? fitToGame(this.add.image(0, 0, GROUND_SHADOW_TEXTURE))
        : this.add.ellipse(0, 0, Math.round(img.width * 0.55), 6, 0x000000, 0.22);
      this.shadows.set(id, shadow);
    }
    shadow.setPosition(px, py - (ground ? 1 : 2)).setDepth(DEPTH.WORLD + py + ACTOR_DEPTH_BIAS - 0.01);
  }

  /** Lift a hovering character for this moment; its shadow shrinks a little as it rises. Reduced motion: it just hovers, still. */
  private applyHover(id: string, img: Phaser.GameObjects.Image): void {
    const float = img.getData('float') as FloatState | null;
    if (!float) return;
    const wave = this.reducedMotion ? 0 : (1 - Math.cos((2 * Math.PI * performance.now()) / FLOAT.periodMs + float.phase)) / 2;
    img.setY(float.baseY - Math.round(FLOAT.lift + FLOAT.amplitude * wave)); // whole pixels keep the pixel art crisp
    this.shadows.get(id)?.setScale(1 - 0.25 * wave);
  }

  /** The frame an animated character should show right now (reduced motion: a wave stays on its first frame). */
  private showFrame(img: Phaser.GameObjects.Image): void {
    const anim = img.getData('anim') as ActorAnim | null;
    if (!anim?.frames.length) return;
    const n = anim.frames.length;
    const step = Math.floor(((performance.now() - anim.startedAt) * anim.fps) / 1000);
    const i = anim.loop ? ((step % n) + n) % n : this.reducedMotion ? 0 : Math.min(Math.max(step, 0), n - 1);
    const key = anim.frames[i];
    if (img.texture.key !== key) fitToGame(img.setTexture(key));
  }

  /** Keep the floating badge in sync: appear with a soft pop, bob gently, fade out when gone. */
  private applyBadge(entry: SpriteEntry, data: RenderSprite, prev: RenderSprite | null): void {
    if (!data.badge) {
      if (entry.badge) this.removeBadge(entry, true);
      return;
    }
    const { img } = entry;
    const at = data.badgeAt;
    const corner = topLeft(img);
    const x = at ? corner.x + at.dx : img.x;
    const y = at ? corner.y + at.dy : img.y - img.displayHeight + 6;
    if (entry.badge && prev?.badge === data.badge) {
      // Same badge; the sprite may have grown taller, so re-seat it on top.
      if (samePlace(prev, data)) return;
      entry.badgeBob?.remove();
      entry.badge.setPosition(x, y);
      this.bobBadge(entry, y);
      return;
    }
    this.removeBadge(entry, false);
    const badge = fitToGame(this.add.image(x, y, data.badge)).setOrigin(0.5, 1).setDepth(DEPTH.INDICATOR - 1);
    badge.setData('interaction', data.interaction);
    if (data.interaction) badge.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
    entry.badge = badge;
    if (!this.reducedMotion && !this.building) this.popIn(badge, 0.3, 280); // not for bubbles already there when entering a room
    this.bobBadge(entry, y);
  }

  private bobBadge(entry: SpriteEntry, y: number): void {
    if (this.reducedMotion || !entry.badge) return;
    entry.badgeBob = this.tweens.add({ targets: entry.badge, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 600 });
  }

  private removeBadge(entry: SpriteEntry, fade: boolean): void {
    const badge = entry.badge;
    entry.badgeBob?.remove();
    entry.badge = entry.badgeBob = undefined;
    if (!badge) return;
    badge.disableInteractive();
    if (!fade || this.reducedMotion) {
      badge.destroy();
      return;
    }
    this.tweens.add({ targets: badge, alpha: 0, y: badge.y - 8, duration: 300, ease: 'Quad.out', onComplete: () => badge.destroy() });
  }

  /** A few twinkles that fade in and out at random spots on the sprite; none when the plant isn't thriving. */
  private applyShine(entry: SpriteEntry, data: RenderSprite, prev: RenderSprite | null): void {
    const unchanged = prev?.shine && samePlace(prev, data);
    if (data.shine && entry.shine && unchanged) return;
    this.removeShine(entry);
    if (!data.shine) return;

    const { img } = entry;
    const spot = (star: Phaser.GameObjects.Image) => {
      const w = img.displayWidth, h = img.displayHeight;
      star.setPosition(img.x + (Math.random() - 0.5) * (w - 8), img.y - 6 - Math.random() * (h - 12));
    };
    // Warm light pooled on the soil under the plant.
    const glow = this.add
      .ellipse(img.x, img.y - 3, img.displayWidth * 0.9, 12, 0xfff3a0, 0.45)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.GROUND_OVERLAY + 1);
    const shine: NonNullable<SpriteEntry['shine']> = { stars: [], glow, tweens: [] };
    if (!this.reducedMotion) {
      shine.tweens.push(this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    }
    const count = img.displayWidth > 32 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const star = this.add.image(0, 0, TWINKLE_TEXTURE).setDepth(DEPTH.INDICATOR - 2);
      spot(star);
      shine.stars.push(star);
      if (this.reducedMotion) {
        star.setAlpha(0.85).setScale(0.6);
        continue;
      }
      star.setAlpha(0).setScale(0.3);
      shine.tweens.push(
        this.tweens.add({
          targets: star,
          alpha: 1,
          scale: { from: 0.3, to: 0.75 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
          delay: i * 700 + Math.random() * 500,
          repeatDelay: 900 + Math.random() * 900,
          onRepeat: () => spot(star),
        }),
      );
    }
    entry.shine = shine;
  }

  /** Pin decals on the sprite, just in front of it. A newly added decal pops in; existing ones stay put. */
  private applyDecals(entry: SpriteEntry, data: RenderSprite, prev: RenderSprite | null): void {
    const before = prev?.decals ?? [];
    const after = data.decals ?? [];
    if (prev && sameDecals(before, after) && samePlace(prev, data)) return;
    this.removeDecals(entry);
    const { img } = entry;
    const corner = topLeft(img);
    after.forEach((d, i) => {
      // Not interactive: decals sit on the sprite, so a tap on one lands on the sprite beneath.
      const decal = fitToGame(this.add.image(corner.x + d.dx, corner.y + d.dy, d.texture))
        .setAngle(d.angle ?? 0)
        .setDepth(img.depth + 0.5 + i * 0.01);
      entry.decals.push(decal);
      if (d.sway) {
        // Pivot on the bottom edge (same spot on screen), then rock like a garden plant.
        decal.setOrigin(0.5, 1).setY(decal.y + decal.displayHeight / 2);
        if (!this.reducedMotion) this.sway(decal);
      }
      const isNew = i >= before.length || before[i].texture !== d.texture;
      if (prev && isNew && !this.building && !this.reducedMotion) this.popIn(decal, 0.2, 260, (i - before.length) * 60);
    });
  }

  /** A grown plant's gentle rocking (garden plants, and plants in pots). */
  private sway(target: Phaser.GameObjects.Image): Phaser.Tweens.Tween {
    return this.tweens.add({ targets: target, angle: { from: -1.5, to: 1.5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 1500 });
  }

  private removeDecals(entry: SpriteEntry): void {
    entry.decals.forEach((d) => {
      this.tweens.killTweensOf(d);
      d.destroy();
    });
    entry.decals = [];
  }

  private removeShine(entry: SpriteEntry): void {
    entry.shine?.tweens.forEach((t) => t.remove());
    entry.shine?.stars.forEach((s) => s.destroy());
    entry.shine?.glow.destroy();
    entry.shine = undefined;
  }

  setHover(rect: TileRect | null): void {
    this.placeRect(this.hover, rect);
  }

  /** What the action button would use right now (soft green outline). */
  setFocus(rect: TileRect | null): void {
    this.placeRect(this.focus, rect);
  }

  setSelection(rect: TileRect | null): void {
    this.placeRect(this.selection, rect);
  }

  /** Translucent preview over a footprint ("+" on an empty plot, a decoration being placed), raised `lift` px. */
  setGhost(ghost: GhostSprite | null): void {
    this.ghost.setVisible(!!ghost);
    if (!ghost) return;
    const { px, py } = this.tiles.anchor(ghost);
    fitToGame(this.ghost.setTexture(ghost.texture)).setPosition(px, py - ghost.lift);
  }

  /** Light up where a decoration can go (null: stop placing). */
  setSpots(tiles: readonly TileCoord[] | null): void {
    this.spots?.forEach((r) => r.destroy());
    this.spots = tiles
      ? tiles.map((t) =>
          this.add
            .rectangle(t.x * TILE_SIZE + 1, t.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2, 0x9cf29c, 0.3)
            .setOrigin(0)
            .setStrokeStyle(1, 0xd8ffd0, 0.8)
            .setDepth(DEPTH.GROUND_OVERLAY + 1), // on the floor and wall, under people and furniture
        )
      : null;
    this.input.setDefaultCursor(tiles ? 'crosshair' : 'default');
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
    if (this.reducedMotion || this.building) return; // no pop for things already in a room we enter
    this.popIn(img, 0.2, 320);
    this.sparkle(img.x, img.y - TILE_SIZE / 2);
  }

  /** Grow from `from` times its resting size back to it, with a little overshoot. */
  private popIn(img: Phaser.GameObjects.Image, from: number, duration: number, delay = 0): void {
    const s = restingScale(img);
    img.setScale(s * from);
    this.tweens.add({ targets: img, scale: s, duration, delay, ease: 'Back.out' });
  }

  private grow(img: Phaser.GameObjects.Image): void {
    if (this.reducedMotion) return;
    const s = restingScale(img);
    this.tweens.add({ targets: img, scaleX: s * 1.15, scaleY: s * 0.85, duration: 120, yoyo: true, ease: 'Quad.out' });
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
    a.sway === b.sway && a.pulse === b.pulse && a.badge === b.badge && a.shine === b.shine &&
    sameDecals(a.decals ?? [], b.decals ?? [])
  );
}

/** Same texture and tile position: anything drawn relative to the sprite can stay put. */
function samePlace(a: RenderSprite, b: RenderSprite): boolean {
  return a.texture === b.texture && a.x === b.x && a.y === b.y;
}

/** The sprite's top-left corner in world pixels (badges and decals are placed from here). */
function topLeft(img: Phaser.GameObjects.Image): { x: number; y: number } {
  const { w, h } = restingSize(img);
  return { x: img.x - w * img.originX, y: img.y - h * img.originY };
}

/** Decal lists are usually the same array (a computed); only compare contents when they aren't. */
function sameDecals(a: readonly RenderDecal[], b: readonly RenderDecal[]): boolean {
  return a === b || decalsKey(a) === decalsKey(b);
}

function decalsKey(decals: readonly RenderDecal[]): string {
  return decals.map((d) => `${d.texture}@${d.dx},${d.dy},${d.angle ?? 0},${d.sway ? 's' : ''}`).join('|');
}
