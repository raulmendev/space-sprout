import { Injectable, inject, signal } from '@angular/core';
import { PLAYER_START, TileCoord, TileRect, findPath, isWalkable, pathToReach } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';

/** Time per tile step. The renderer animates the same duration. */
export const STEP_MS = 140;

/**
 * The local player's avatar. Position is app state (Angular), stepped along a
 * grid path; Phaser only animates between tiles. Ready for a second, remote
 * player later: that one would just be another position fed from the server.
 */
@Injectable({ providedIn: 'root' })
export class PlayerStore {
  private readonly garden = inject(GardenStore);

  readonly tile = signal<TileCoord>(PLAYER_START);
  readonly facingLeft = signal(false);

  private path: TileCoord[] = [];
  private onArrive: (() => void) | null = null;
  private timer?: ReturnType<typeof setInterval>;

  /** Walk to a floor tile. Returns false if it can't be reached. */
  walkTo(dest: TileCoord): boolean {
    const path = findPath(this.tile(), dest, this.garden.objects());
    if (!path) return false;
    this.follow(path, null);
    return true;
  }

  /** Walk up to something, then do `action`. Unreachable targets act immediately. */
  approach(rect: TileRect, action: () => void): void {
    const path = pathToReach(this.tile(), rect, this.garden.objects());
    if (!path) {
      this.stop();
      action();
      return;
    }
    this.follow(path, action);
  }

  /** One tile in a direction (keyboard). Cancels any walk in progress. */
  step(dx: number, dy: number): void {
    if (this.timer && this.path.length) return; // let the current walk finish
    this.path = [];
    this.onArrive = null;
    const cur = this.tile();
    if (dx) this.facingLeft.set(dx < 0);
    if (!isWalkable(cur.x + dx, cur.y + dy, this.garden.objects())) return;
    this.follow([{ x: cur.x + dx, y: cur.y + dy }], null);
  }

  reset(): void {
    this.stop();
    this.tile.set(PLAYER_START);
  }

  private follow(path: TileCoord[], action: (() => void) | null): void {
    this.path = path;
    this.onArrive = action;
    if (!path.length) return this.arrive();
    if (!this.timer) {
      this.advance();
      this.timer = setInterval(() => this.advance(), STEP_MS);
    }
  }

  private advance(): void {
    const next = this.path.shift();
    if (!next) return this.arrive();
    const cur = this.tile();
    if (next.x !== cur.x) this.facingLeft.set(next.x < cur.x);
    this.tile.set(next);
  }

  private arrive(): void {
    const action = this.onArrive;
    this.stop();
    action?.();
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.path = [];
    this.onArrive = null;
  }
}
