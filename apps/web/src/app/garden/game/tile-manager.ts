import Phaser from 'phaser';
import { HABITAT_COLS, HABITAT_ROWS, TILE_SIZE, TileCoord, TileRect, getTileKind } from '@garden/shared';
import { tileTextureKey } from './asset-registry';

export type { TileCoord, TileRect };

export const WORLD_W = HABITAT_COLS * TILE_SIZE;
export const WORLD_H = HABITAT_ROWS * TILE_SIZE;

/** Draws the static ground layer and converts between pixel and tile space. */
export class TileManager {
  constructor(private readonly scene: Phaser.Scene) {}

  drawGround(depth: number): void {
    for (let y = 0; y < HABITAT_ROWS; y++) {
      for (let x = 0; x < HABITAT_COLS; x++) {
        const kind = getTileKind(x, y);
        if (kind) this.scene.add.image(x * TILE_SIZE, y * TILE_SIZE, tileTextureKey(kind, x, y)).setOrigin(0).setDepth(depth);
      }
    }
  }

  toTile(px: number, py: number): TileCoord | null {
    const x = Math.floor(px / TILE_SIZE);
    const y = Math.floor(py / TILE_SIZE);
    if (x < 0 || y < 0 || x >= HABITAT_COLS || y >= HABITAT_ROWS) return null;
    return { x, y };
  }

  /** Bottom-centre of a footprint: the placement reference for every sprite. */
  anchor(r: TileRect): { px: number; py: number } {
    return { px: (r.x + r.w / 2) * TILE_SIZE, py: (r.y + r.h) * TILE_SIZE };
  }
}
