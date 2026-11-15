import { Component, ElementRef, afterNextRender, inject, output, signal } from '@angular/core';
import { EMOTES, EmoteId } from '@garden/shared';

/**
 * Geometry, as % of the wheel's box, after the design concept: the ring fills 88% of it and the
 * slots sit on its edge, spilling a little over it; the centre names the emote in focus.
 */
const SLOT_RADIUS = 37.5;
const SLOTS = EMOTES.map((e, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / EMOTES.length;
  return { ...e, left: 50 + SLOT_RADIUS * Math.cos(angle), top: 50 + SLOT_RADIUS * Math.sin(angle) };
});

/**
 * The emote wheel: every emote on a ring around a centre that names the one under the
 * pointer (or focus). One tap sends it. Arrow keys go round the ring; Escape or a tap
 * outside closes it.
 */
@Component({
  selector: 'app-emote-wheel',
  host: {
    class: 'fixed inset-0 z-50 grid place-items-center bg-night/30',
    '(click)': 'closed.emit()',
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div role="dialog" aria-label="Send an emote" class="wheel relative" (click)="$event.stopPropagation()" (keydown)="onKey($event)">
      <div class="ring absolute inset-[6%] rounded-full" aria-hidden="true"></div>
      <div class="hub absolute left-1/2 top-1/2 grid size-[36%] -translate-x-1/2 -translate-y-1/2 place-content-center justify-items-center rounded-full" aria-hidden="true">
        <!-- A one-item loop keyed on the emote: a new one re-renders, so its pop-in plays again. -->
        @for (s of [slots[active()]]; track s.id) {
          <span class="hub-glyph leading-none">{{ s.glyph }}</span>
          <span class="hub-label font-extrabold leading-none text-white">{{ s.label }}</span>
        }
      </div>
      @for (s of slots; track s.id; let i = $index) {
        <button
          type="button"
          class="slot absolute grid size-[25%] place-items-center rounded-full leading-none focus-visible:outline-none"
          [class.active]="i === active()"
          [style.left.%]="s.left"
          [style.top.%]="s.top"
          [style.--i]="i"
          [attr.aria-label]="s.label"
          (pointerenter)="active.set(i)"
          (focus)="active.set(i)"
          (click)="picked.emit(s.id)"
        >{{ s.glyph }}</button>
      }
    </div>
  `,
  styles: `
    /* Fits a landscape phone: never more than ~84% of the screen's height. Sizes inside are in cqw (% of the wheel). */
    .wheel { width: min(19rem, 84svh, 90vw); aspect-ratio: 1; container-type: inline-size; animation: wheel-in 160ms ease-out; }
    /* A pink ring behind purple emote circles and a dark purple centre. */
    .ring {
      /* See-through, so the room stays visible behind it; the slots and centre stay solid. */
      background: radial-gradient(circle at 50% 35%, rgb(240 130 180 / 0.62), rgb(214 92 152 / 0.62) 70%);
      backdrop-filter: blur(2px);
      border: 3px solid #ffb6d9;
      box-shadow: 0 0 0 5px rgb(255 160 205 / 0.2), 0 10px 28px rgb(0 0 0 / 0.3), inset 0 2px 0 rgb(255 255 255 / 0.15);
    }
    .hub {
      gap: 1.5cqw;
      background: radial-gradient(circle at 50% 30%, #2b2549, #1b1731 75%);
      border: 3px solid #a695c5;
      box-shadow: inset 0 3px 8px rgb(0 0 0 / 0.45), 0 2px 0 rgb(255 255 255 / 0.05);
    }
    .hub-glyph { font-size: 13cqw; animation: glyph-in 140ms ease-out; }
    .hub-label { font-size: 4.6cqw; letter-spacing: 0.01em; }
    .slot {
      translate: -50% -50%;
      font-size: 11cqw;
      background: linear-gradient(#564a78, #483e66);
      border: 3px solid #786999;
      box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.22), inset 0 2px 0 rgb(255 255 255 / 0.08), 0 3px 6px rgb(0 0 0 / 0.3);
      transition: background 100ms, border-color 100ms, box-shadow 100ms, scale 120ms ease-out;
      animation: slot-in 220ms calc(var(--i) * 18ms) ease-out backwards;
    }
    .slot.active {
      scale: 1.08;
      background: linear-gradient(#8270b0, #6c5a98);
      border-color: #f8d386;
      box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2), 0 0 0 3px rgb(248 211 134 / 0.25), 0 0 16px rgb(248 211 134 / 0.45);
    }
    .slot:active { scale: 0.94; }
    @keyframes wheel-in { from { opacity: 0; scale: 0.88; } }
    @keyframes slot-in { from { opacity: 0; scale: 0.5; } }
    @keyframes glyph-in { from { opacity: 0.4; scale: 0.8; } }
  `,
})
export class EmoteWheelComponent {
  readonly picked = output<EmoteId>();
  readonly closed = output<void>();
  protected readonly slots = SLOTS;
  /** The emote named in the centre: the one under the pointer or with focus. */
  protected readonly active = signal(0);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    afterNextRender(() => this.focusSlot(0));
  }

  /** Arrows go round the ring (right/down clockwise); Home/End jump to the ends. */
  protected onKey(e: KeyboardEvent): void {
    const n = SLOTS.length;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next: number | null = step ? (this.active() + step + n) % n : null;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    this.focusSlot(next);
  }

  /** Focus a slot; its focus handler names it in the centre. */
  private focusSlot(i: number): void {
    this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button.slot')[i]?.focus();
  }
}
