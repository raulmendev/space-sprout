import Phaser from 'phaser';
import { GRID_SIZE, getTileKind } from '@garden/shared';
import { TILE_PX, tileTextureKey } from './plant-sprites';

export interface TileCoord {
  x: number;
  y: number;
}

/** Draws the static ground layer and converts between pixel and tile space. */
export class TileManager {
  readonly worldPx = GRID_SIZE * TILE_PX;

  constructor(private readonly scene: Phaser.Scene) {}

  drawGround(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const kind = getTileKind(x, y);
        if (!kind) continue;
        this.scene.add.image(x * TILE_PX, y * TILE_PX, tileTextureKey(kind, x, y)).setOrigin(0).setDepth(0);
      }
    }
  }

  toTile(px: number, py: number): TileCoord | null {
    const x = Math.floor(px / TILE_PX);
    const y = Math.floor(py / TILE_PX);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
    return { x, y };
  }

  /** Bottom-center of a tile — anchor point for sprites standing on it. */
  anchor(tile: TileCoord): { px: number; py: number } {
    return { px: tile.x * TILE_PX + TILE_PX / 2, py: tile.y * TILE_PX + TILE_PX };
  }
}
