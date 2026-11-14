import { Injectable, computed, inject, signal } from '@angular/core';
import { HabitatPosition, PLAYER_START, Point, TileRect, doorAt, planReach, slide, tileCenter, tileOf } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { Ticker } from './ticker.service';

/** Walking speed, in tiles per second. */
const SPEED = 6;

/**
 * The local player's avatar. Position (room + continuous point) is app state,
 * moved every frame by held keys / the on-screen pad, or along a smoothed route
 * when walking up to something that was tapped. Phaser only draws it.
 * Walking onto a door moves the player to the connected room. A second, remote
 * player later is just another position fed from the server.
 */
@Injectable({ providedIn: 'root' })
export class PlayerStore {
  private readonly garden = inject(GardenStore);
  private readonly ticker = inject(Ticker);

  readonly position = signal<HabitatPosition>(PLAYER_START);
  readonly room = computed(() => this.position().room);
  readonly facingLeft = signal(false);
  readonly moving = signal(false);

  private route: Point[] = [];
  private onArrive: (() => void) | null = null;
  private readonly keys = { x: 0, y: 0 };
  private readonly held = new Set<string>();
  /** On-screen pad direction, unit length or zero. */
  private readonly pad = { x: 0, y: 0 };

  /** Walk up to something in the current room, then do `action`. Unreachable targets act immediately. */
  approach(rect: TileRect, action: () => void): void {
    const route = planReach(this.room(), this.position(), rect, this.garden.objects());
    if (!route) {
      this.stopRoute();
      action();
      return;
    }
    this.follow(route, action);
  }

  /** Held direction keys (e.g. 'up'), for smooth keyboard movement. */
  setKey(dir: 'up' | 'down' | 'left' | 'right', down: boolean): void {
    if (down) this.held.add(dir);
    else this.held.delete(dir);
    this.keys.x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    this.keys.y = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0);
    this.steer();
  }

  /** Direction from the on-screen pad, any length (normalised here); (0, 0) releases it. */
  setPad(x: number, y: number): void {
    const len = Math.hypot(x, y);
    this.pad.x = len ? x / len : 0;
    this.pad.y = len ? y / len : 0;
    this.steer();
  }

  releaseKeys(): void {
    this.held.clear();
    this.keys.x = this.keys.y = 0;
    this.pad.x = this.pad.y = 0;
  }

  /** Manual steering (keys or pad) takes over from any walk-up route. */
  private steer(): void {
    if (this.keys.x || this.keys.y || this.pad.x || this.pad.y) {
      this.stopRoute();
      this.ticker.add(this.tick);
    }
  }

  reset(): void {
    this.stopRoute();
    this.releaseKeys();
    this.position.set(PLAYER_START);
  }

  private follow(route: Point[], action: (() => void) | null): void {
    this.route = route;
    this.onArrive = action;
    if (!route.length) return this.arrive();
    this.ticker.add(this.tick);
  }

  private readonly tick = (dt: number): void => {
    const pos = this.position();
    let dx = 0;
    let dy = 0;

    const manual = this.keys.x || this.keys.y ? this.keys : this.pad;
    if (manual.x || manual.y) {
      const len = Math.hypot(manual.x, manual.y);
      dx = (manual.x / len) * SPEED * dt;
      dy = (manual.y / len) * SPEED * dt;
    } else if (this.route.length) {
      const target = this.route[0];
      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
      const stepLen = SPEED * dt;
      if (dist <= stepLen) {
        dx = target.x - pos.x;
        dy = target.y - pos.y;
        this.route.shift();
      } else {
        dx = ((target.x - pos.x) / dist) * stepLen;
        dy = ((target.y - pos.y) / dist) * stepLen;
      }
    }

    if (!dx && !dy) {
      this.moving.set(false);
      if (!this.route.length && this.onArrive) this.arrive();
      if (!this.route.length) this.ticker.remove(this.tick);
      return;
    }

    const next = slide(pos.room, pos, dx, dy, this.garden.objects());
    if (next.x === pos.x && next.y === pos.y) {
      // Blocked (shouldn't happen on a planned route): give up rather than push against a wall.
      this.route = [];
    }
    if (Math.abs(dx) > 1e-4) this.facingLeft.set(dx < 0);
    this.moving.set(true);

    const t = tileOf(next);
    const door = doorAt(pos.room, t.x, t.y);
    if (door) {
      // Through the door: appear just inside the next room. A click-walk ends here.
      this.stopRoute();
      this.position.set({ room: door.to, ...tileCenter(door.arrive) });
      return;
    }
    this.position.set({ room: pos.room, ...next });
  };

  private arrive(): void {
    const action = this.onArrive;
    this.stopRoute();
    action?.();
  }

  private stopRoute(): void {
    this.route = [];
    this.onArrive = null;
  }
}
