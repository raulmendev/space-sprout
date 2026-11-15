import { Component, inject, output } from '@angular/core';
import { HabitatStore } from './habitat.store';

/**
 * Low-opacity "use" button opposite the pad. It lights up when something usable
 * is within reach and says what it will do; E / Space do the same on a keyboard.
 *
 * Fires on pointerdown, not click: on phones one thumb is usually still on the
 * pad, and browsers often don't synthesise a click for a tap while another
 * finger is down. Keyboard activation (Enter/Space on the focused button) still
 * arrives as a click with no pointer, and is handled there.
 */
@Component({
  selector: 'app-action-button',
  // Fixed width (the label's max): a longer or shorter label must not shift the button.
  host: { class: 'flex w-[8.5rem] flex-col items-center gap-1.5 select-none [@media(max-height:420px)]:w-[7rem]' },
  template: `
    <span
      class="max-w-[8.5rem] rounded-md px-2 py-0.5 text-center text-xs font-bold leading-tight [@media(max-height:420px)]:max-w-[7rem] [@media(max-height:420px)]:text-[10px]"
      [class]="target() ? 'bg-night/80 text-cream' : 'bg-night/50 text-cream/70'"
      aria-hidden="true"
    >{{ target()?.label ?? 'Walk up to something' }}</span>
    <button
      type="button"
      class="grid size-16 touch-none place-items-center [@media(max-height:420px)]:size-14 rounded-full border-2 font-pixel text-2xl text-cream transition-opacity focus-visible:outline-2 focus-visible:outline-sun"
      [class]="target() ? 'border-cream/80 bg-leaf-dark/60 opacity-95' : 'border-cream/40 bg-night/40 opacity-35'"
      [attr.aria-disabled]="!target()"
      [attr.aria-label]="target()?.label ?? 'Nothing to use nearby'"
      [title]="(target()?.label ?? 'Nothing to use nearby') + ' (E or Space)'"
      (pointerdown)="press($event)"
      (click)="keyboardClick($event)"
    >A</button>
  `,
})
export class ActionButtonComponent {
  protected readonly target = inject(HabitatStore).reachable;
  readonly act = output<void>();

  protected press(e: PointerEvent): void {
    if (e.button > 0) return; // ignore right/middle mouse buttons
    e.preventDefault(); // keep focus where it is; don't start a text selection
    if (this.target()) this.act.emit();
  }

  /** Only keyboard activation lands here (pointer presses were handled on pointerdown). */
  protected keyboardClick(e: MouseEvent): void {
    if (e.detail === 0 && this.target()) this.act.emit();
  }
}
