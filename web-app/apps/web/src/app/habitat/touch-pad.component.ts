import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { PlayerStore } from './player.store';
import { t } from '../i18n/i18n';

/** Ignore tiny drags around the centre so a tap doesn't nudge the player. */
const DEAD_ZONE = 0.25;

/**
 * Low-opacity on-screen direction pad for touch screens (works with a mouse too).
 * Press and drag anywhere on it: the direction from its centre steers the player,
 * in any of 8+ directions. Keyboard WASD / arrows keep working alongside it.
 */
@Component({
  selector: 'app-touch-pad',
  host: { class: 'block select-none' },
  template: `
    <div
      #pad
      class="pad relative size-32 touch-none rounded-full [@media(max-height:420px)]:size-28 border-2 border-cream/50 bg-night/40 transition-opacity"
      [class.opacity-35]="!active()"
      [class.opacity-80]="active()"
      role="group"
      [attr.aria-label]="t('Move: press and drag. Keyboard: WASD or arrow keys')"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end($event)"
      (pointercancel)="end($event)"
      (lostpointercapture)="end($event)"
    >
      <span aria-hidden="true" class="arrow left-1/2 top-1 -translate-x-1/2">▲</span>
      <span aria-hidden="true" class="arrow bottom-1 left-1/2 -translate-x-1/2">▼</span>
      <span aria-hidden="true" class="arrow left-1.5 top-1/2 -translate-y-1/2">◀</span>
      <span aria-hidden="true" class="arrow right-1.5 top-1/2 -translate-y-1/2">▶</span>
      <span
        aria-hidden="true"
        class="absolute left-1/2 top-1/2 size-11 rounded-full border-2 border-cream/70 bg-cream/40"
        [style.transform]="'translate(-50%, -50%) translate(' + knob().x + 'px, ' + knob().y + 'px)'"
      ></span>
    </div>
  `,
  styles: `
    .arrow { position: absolute; color: var(--color-cream); font-size: 14px; line-height: 1; }
  `,
})
export class TouchPadComponent {
  protected readonly t = t;
  private readonly player = inject(PlayerStore);
  private readonly pad = viewChild.required<ElementRef<HTMLDivElement>>('pad');
  protected readonly active = signal(false);
  protected readonly knob = signal({ x: 0, y: 0 });
  private pointerId: number | null = null;

  protected start(e: PointerEvent): void {
    if (this.pointerId !== null) return; // one finger steers; others are free for taps
    this.pointerId = e.pointerId;
    this.pad().nativeElement.setPointerCapture(e.pointerId);
    this.active.set(true);
    this.move(e);
  }

  protected move(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const r = this.pad().nativeElement.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (e.clientX - (r.left + radius)) / radius;
    let y = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const knobTravel = radius * 0.55;
    this.knob.set({ x: x * knobTravel, y: y * knobTravel });
    if (len < DEAD_ZONE) this.player.setPad(0, 0);
    else this.player.setPad(x, y);
  }

  protected end(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.active.set(false);
    this.knob.set({ x: 0, y: 0 });
    this.player.setPad(0, 0);
  }
}
