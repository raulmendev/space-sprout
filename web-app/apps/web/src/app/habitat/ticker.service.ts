import { Injectable } from '@angular/core';

type Tick = (dtSeconds: number) => void;

/** One requestAnimationFrame loop shared by every moving character; idle when nothing moves. */
@Injectable({ providedIn: 'root' })
export class Ticker {
  private readonly ticks = new Set<Tick>();
  private frame = 0;
  private last = 0;

  add(tick: Tick): void {
    this.ticks.add(tick);
    if (!this.frame) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
    }
  }

  remove(tick: Tick): void {
    this.ticks.delete(tick);
  }

  private readonly loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000); // clamp after tab switches
    this.last = now;
    this.ticks.forEach((t) => t(dt));
    this.frame = this.ticks.size ? requestAnimationFrame(this.loop) : 0;
  };
}
