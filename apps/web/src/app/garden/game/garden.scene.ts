import Phaser from 'phaser';
import { NPC_TILE } from '@garden/shared';
import { NPC_TEXTURE, TILE_PX, buildAllTextures } from './plant-sprites';
import { TileCoord, TileManager } from './tile-manager';

/** What the scene needs to draw an object. Computed by Angular; no rules here. */
export interface RenderableObject {
  id: string;
  x: number;
  y: number;
  texture: string;
}

/** Callbacks from the scene to Angular. The scene reports input; it decides nothing. */
export interface GardenSceneBridge {
  onReady(scene: GardenScene): void;
  onTileClicked(tile: TileCoord): void;
  onTileHovered(tile: TileCoord | null): void;
  onNpcClicked(): void;
}

export class GardenScene extends Phaser.Scene {
  private tiles!: TileManager;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private hover!: Phaser.GameObjects.Rectangle;
  private selection!: Phaser.GameObjects.Rectangle;
  private npc!: Phaser.GameObjects.Image;
  private npcAlert?: Phaser.GameObjects.Text;
  private ghost!: Phaser.GameObjects.Image;
  private hoverKey = '';

  constructor(private readonly bridge: GardenSceneBridge) {
    super('garden');
  }

  preload(): void {
    for (const [key, canvas] of buildAllTextures()) {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
    }
  }

  create(): void {
    this.tiles = new TileManager(this);
    this.tiles.drawGround();

    this.hover = this.add
      .rectangle(0, 0, TILE_PX, TILE_PX)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.45)
      .setDepth(900)
      .setVisible(false);

    this.selection = this.add
      .rectangle(0, 0, TILE_PX, TILE_PX)
      .setOrigin(0)
      .setStrokeStyle(2, 0xfff3a0, 1)
      .setDepth(901)
      .setVisible(false);
    this.tweens.add({ targets: this.selection, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    this.ghost = this.add.image(0, 0, 'plant-flower').setOrigin(0.5, 1).setAlpha(0.55).setDepth(902).setVisible(false);
    this.tweens.add({ targets: this.ghost, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.createNpc();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const t = this.tiles.toTile(p.worldX, p.worldY);
      this.hover.setVisible(!!t);
      if (t) this.hover.setPosition(t.x * TILE_PX, t.y * TILE_PX);
      const key = t ? `${t.x},${t.y}` : '';
      if (key !== this.hoverKey) {
        this.hoverKey = key;
        this.bridge.onTileHovered(t);
      }
    });
    this.input.on('gameout', () => {
      this.hover.setVisible(false);
      this.hoverKey = '';
      this.bridge.onTileHovered(null);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.includes(this.npc)) return;
      const t = this.tiles.toTile(p.worldX, p.worldY);
      if (t) this.bridge.onTileClicked(t);
    });

    this.bridge.onReady(this);
  }

  private createNpc(): void {
    const { px, py } = this.tiles.anchor(NPC_TILE);
    this.add.ellipse(px, py - 3, 22, 7, 0x000000, 0.18).setDepth(py - 1);
    this.npc = this.add
      .image(px, py - 2, NPC_TEXTURE)
      .setOrigin(0.5, 1)
      .setDepth(py)
      .setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.tweens.add({ targets: this.npc, y: py - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.npc.on('pointerdown', () => {
      this.tweens.add({ targets: this.npc, scaleX: 1.15, scaleY: 0.88, duration: 90, yoyo: true });
      this.bridge.onNpcClicked();
    });
  }

  /** Reconcile displayed sprites with the given state (diff by id). */
  syncObjects(objects: readonly RenderableObject[]): void {
    const seen = new Set<string>();
    for (const obj of objects) {
      seen.add(obj.id);
      const { px, py } = this.tiles.anchor(obj);
      const existing = this.sprites.get(obj.id);
      if (!existing) {
        const img = this.add.image(px, py, obj.texture).setOrigin(0.5, 1).setDepth(py);
        this.sprites.set(obj.id, img);
        this.pop(img);
      } else if (existing.texture.key !== obj.texture) {
        existing.setTexture(obj.texture);
        this.grow(existing);
      }
    }
    for (const [id, img] of this.sprites) {
      if (!seen.has(id)) {
        img.destroy();
        this.sprites.delete(id);
      }
    }
  }

  /** Translucent preview of what a click would plant. Angular decides when to show it. */
  setGhost(ghost: RenderableObject | null): void {
    this.ghost.setVisible(!!ghost);
    this.input.setDefaultCursor(ghost ? 'pointer' : 'default');
    if (!ghost) return;
    const { px, py } = this.tiles.anchor(ghost);
    this.ghost.setTexture(ghost.texture).setPosition(px, py - 4);
  }

  setSelectedTile(tile: TileCoord | null): void {
    this.selection.setVisible(!!tile);
    if (tile) this.selection.setPosition(tile.x * TILE_PX, tile.y * TILE_PX);
  }

  /** Small "!" above the NPC when it has something to say. */
  setNpcAlert(on: boolean): void {
    if (on && !this.npcAlert) {
      this.npcAlert = this.add
        .text(this.npc.x, this.npc.y - TILE_PX - 4, '!', {
          fontFamily: '"Pixelify Sans", monospace',
          fontSize: '16px',
          color: '#fff3a0',
          stroke: '#2b2238',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(1000);
      this.tweens.add({ targets: this.npcAlert, y: '-=4', duration: 400, yoyo: true, repeat: -1 });
    } else if (!on && this.npcAlert) {
      this.npcAlert.destroy();
      this.npcAlert = undefined;
    }
  }

  /** Short invalid-action feedback on a tile. */
  shakeTile(tile: TileCoord): void {
    const flash = this.add
      .rectangle(tile.x * TILE_PX, tile.y * TILE_PX, TILE_PX, TILE_PX, 0xff8080, 0.35)
      .setOrigin(0)
      .setDepth(950);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
  }

  private pop(img: Phaser.GameObjects.Image): void {
    img.setScale(0.2);
    this.tweens.add({ targets: img, scale: 1, duration: 320, ease: 'Back.out' });
    this.sparkle(img.x, img.y - TILE_PX / 2);
  }

  private grow(img: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: img, scaleX: 1.2, scaleY: 0.8, duration: 120, yoyo: true, ease: 'Quad.out' });
    this.sparkle(img.x, img.y - TILE_PX / 2);
  }

  private sparkle(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const dot = this.add.rectangle(x, y, 3, 3, i % 2 ? 0xfff3a0 : 0xffffff).setDepth(999);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 14,
        y: y + Math.sin(angle) * 14,
        alpha: 0,
        duration: 450,
        ease: 'Quad.out',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
