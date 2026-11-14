import Phaser from 'phaser';
import { ROOM_COLS, ROOM_ROWS, RoomId, TILE_SIZE, TileCoord, TileRect, getTileKind } from '@garden/shared';
import { tileTextureKey } from './asset-registry';

export type { TileCoord, TileRect };

export const WORLD_W = ROOM_COLS * TILE_SIZE;
export const WORLD_H = ROOM_ROWS * TILE_SIZE;

/** Draws a room's static ground layer and converts between pixel and tile space. */
export class TileManager {
  constructor(private readonly scene: Phaser.Scene) {}

  drawGround(room: RoomId, depth: number): Phaser.GameObjects.Image[] {
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
