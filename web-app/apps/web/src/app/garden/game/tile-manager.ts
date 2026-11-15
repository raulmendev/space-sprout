import Phaser from 'phaser';
import { ROOM_COLS, ROOM_ROWS, RoomId, TILE_SIZE, TileCoord, TileRect, getTileKind } from '@garden/shared';
import { getAsset, roomTextureKey, tileTextureKey } from './asset-registry';

export type { TileCoord, TileRect };

export const WORLD_W = ROOM_COLS * TILE_SIZE;
export const WORLD_H = ROOM_ROWS * TILE_SIZE;

/** Scale per texture key, worked out once (texture sizes don't change after loading). */
const fitScales = new Map<string, number>();

/**
 * The scale that shows a texture at its game size (its registered width). Hi-res art (delivered
 * at 2x, 64 px per tile) is scaled down with smooth filtering, so a canvas rendering at the
 * screen's resolution keeps its detail; everything else (pixel placeholders, 1x art) stays 1:1
 * and crisp. Tweens that pop or squash a sprite scale relative to this.
 */
export function restingScale(img: Phaser.GameObjects.Image): number {
  const key = img.texture.key;
  let scale = fitScales.get(key);
  if (scale === undefined) {
    const width = getAsset(key)?.width;
    const source = img.texture.source[0].width;
    scale = width && source >= width * 1.5 ? width / source : 1;
    if (scale !== 1) img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    fitScales.set(key, scale);
  }
  return scale;
}

/** Show an image at its game size (see restingScale). */
export function fitToGame<T extends Phaser.GameObjects.Image>(img: T): T {
  return img.setScale(restingScale(img));
}

/** Size in world pixels at rest. */
export function restingSize(img: Phaser.GameObjects.Image): { w: number; h: number } {
  const s = restingScale(img);
  return { w: img.width * s, h: img.height * s };
}

/** Draws a room's static ground layer and converts between pixel and tile space. */
export class TileManager {
  constructor(private readonly scene: Phaser.Scene) {}

  drawGround(room: RoomId, depth: number): Phaser.GameObjects.Image[] {
    // The room's painted picture, when the design team has delivered one; else tile by tile.
    const picture = roomTextureKey(room);
    if (this.scene.textures.exists(picture)) return [fitToGame(this.scene.add.image(0, 0, picture)).setOrigin(0).setDepth(depth)];
    const images: Phaser.GameObjects.Image[] = [];
    for (let y = 0; y < ROOM_ROWS; y++) {
      for (let x = 0; x < ROOM_COLS; x++) {
        const kind = getTileKind(room, x, y);
        if (kind) images.push(this.scene.add.image(x * TILE_SIZE, y * TILE_SIZE, tileTextureKey(kind, x, y)).setOrigin(0).setDepth(depth));
      }
    }
    return images;
  }

  toTile(px: number, py: number): TileCoord | null {
    const x = Math.floor(px / TILE_SIZE);
    const y = Math.floor(py / TILE_SIZE);
    if (x < 0 || y < 0 || x >= ROOM_COLS || y >= ROOM_ROWS) return null;
    return { x, y };
  }

  /** Bottom-centre of a footprint: the placement reference for every sprite. */
  anchor(r: TileRect): { px: number; py: number } {
    return { px: (r.x + r.w / 2) * TILE_SIZE, py: (r.y + r.h) * TILE_SIZE };
  }
}
