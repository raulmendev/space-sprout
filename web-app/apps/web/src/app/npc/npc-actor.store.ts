import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NPC_HOME, Point, canStand, clearLine } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { PlayerStore } from '../habitat/player.store';
import { Ticker } from '../habitat/ticker.service';
import { NpcStore } from './npc.store';

const SPEED = 1.4; // tiles per second: an amble
const WANDER_RADIUS = 2.5;

/**
 * Where Sprout is and where it's strolling to. Wanders near home every few
 * seconds while the player is in its room; stands still while talking.
 */
@Injectable({ providedIn: 'root' })
export class NpcActorStore {
  private readonly garden = inject(GardenStore);
  private readonly player = inject(PlayerStore);
  private readonly dialogue = inject(NpcStore);
  private readonly ticker = inject(Ticker);

  readonly room = NPC_HOME.room;
  readonly position = signal<Point>({ x: NPC_HOME.x, y: NPC_HOME.y });
  readonly facingLeft = signal(false);
  readonly moving = signal(false);

  private target: Point | null = null;
  private restUntil = 0;
  private readonly active = computed(() => this.player.room() === this.room);

  constructor() {
    // Only bother wandering while someone can see it.
    effect(() => (this.active() ? this.ticker.add(this.tick) : untracked(() => this.ticker.remove(this.tick))));
  }

  /** Stop and face the player, e.g. when they come to talk. */
  hold(): void {
    this.target = null;
    this.moving.set(false);
    this.restUntil = performance.now() + 8000;
    this.facingLeft.set(this.player.position().x < this.position().x);
  }

  private readonly tick = (dt: number): void => {
    const now = performance.now();
    if (this.dialogue.current()) {
      this.restUntil = Math.max(this.restUntil, now + 1500);
      this.target = null;
    }
    if (!this.target) {
      this.moving.set(false);
      if (now < this.restUntil) return;
      this.target = this.pickSpot();
      this.restUntil = now + 2500 + Math.random() * 4000;
      return;
    }

    const pos = this.position();
    const dist = Math.hypot(this.target.x - pos.x, this.target.y - pos.y);
    const step = SPEED * dt;
    if (dist <= step) {
      this.position.set(this.target);
      this.target = null;
      return;
    }
    const dx = ((this.target.x - pos.x) / dist) * step;
    this.facingLeft.set(dx < 0);
    this.moving.set(true);
    this.position.set({ x: pos.x + dx, y: pos.y + ((this.target.y - pos.y) / dist) * step });
  };

  /** A random nearby spot it can walk to in a straight line, or null to stay put. */
  private pickSpot(): Point | null {
    const from = this.position();
    const objects = this.garden.objects();
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * WANDER_RADIUS;
      const p = { x: NPC_HOME.x + Math.cos(a) * r, y: NPC_HOME.y + Math.sin(a) * r * 0.6 };
      if (canStand(this.room, p, objects) && clearLine(this.room, from, p, objects)) return p;
    }
    return null;
  }
}
