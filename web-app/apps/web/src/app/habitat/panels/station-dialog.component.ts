import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import type { HabitatPanel } from '../habitat.store';
import { StationPanelComponent } from './station-panel.component';

/**
 * A station panel as a modal popup (native <dialog> via showModal()): the page
 * goes inert, focus stays inside and returns afterwards, Esc / back gesture
 * close it, and clicking the backdrop closes it too. It is centred over
 * `anchor` (the room view) rather than the whole window, and no wider than it.
 */
@Component({
  selector: 'app-station-dialog',
  imports: [StationPanelComponent],
  template: `
    <dialog #dialog closedby="any" aria-labelledby="panel-title" (close)="closed.emit()" (click)="lightDismissFallback($event)">
      <app-station-panel [panel]="panel()" (closed)="dialog.close()" />
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      background: transparent;
      /* Never bigger than the room view it sits on (or the screen). */
      width: min(52rem, var(--anchor-w, 100vw) - 1rem, 100vw - 1rem);
      max-height: min(var(--anchor-h, 100dvh) - 1rem, 100dvh - 1rem);
      overflow: auto;
    }
    /* Centre over the room view (falls back to the viewport centre without an anchor). */
    dialog:modal {
      margin: 0;
      inset: auto;
      position: fixed;
      left: var(--anchor-cx, 50vw);
      top: clamp(1rem, var(--anchor-cy, 50dvh), 100dvh - 1rem);
      translate: -50% -50%;
      /* Keep scroll gestures from reaching the page behind (with the ::backdrop rule below). */
      overscroll-behavior: contain;
    }
    dialog::backdrop {
      background: rgb(29 27 58 / 0.55);
      overflow: hidden;
      overscroll-behavior: contain;
    }
  `,
})
export class StationDialogComponent {
  readonly panel = input.required<HabitatPanel>();
  /** Element to centre over (the room view). */
  readonly anchor = input<HTMLElement | null>(null);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      const place = () => this.placeOverAnchor(dialog);
      place();
      dialog.showModal();
      const anchor = this.anchor();
      const ro = anchor ? new ResizeObserver(place) : null;
      if (anchor) ro!.observe(anchor);
      window.addEventListener('resize', place);
      destroyRef.onDestroy(() => {
        ro?.disconnect();
        window.removeEventListener('resize', place);
      });
    });
  }

  /** Expose the anchor's centre and width as CSS variables the dialog positions itself with. */
  private placeOverAnchor(dialog: HTMLDialogElement): void {
    const anchor = this.anchor();
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    dialog.style.setProperty('--anchor-cx', `${r.left + r.width / 2}px`);
    dialog.style.setProperty('--anchor-cy', `${r.top + r.height / 2}px`);
    dialog.style.setProperty('--anchor-w', `${r.width}px`);
    dialog.style.setProperty('--anchor-h', `${r.height}px`);
  }

  /** Safari lacks closedby="any": close when a click lands on the backdrop (outside the dialog box). */
  protected lightDismissFallback(e: MouseEvent): void {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const dialog = this.dialog().nativeElement;
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
    if (!inside) dialog.close();
  }
}
