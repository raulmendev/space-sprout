import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, output, untracked, viewChild } from '@angular/core';
import { PlacementError, ROOM_COLS, footprintOf } from '@garden/shared';
import { colPct, rowPct } from '../../habitat/tile-percent';
import { GardenStore } from '../garden.store';
import { AssetService } from '../../shared/assets.service';
import { previewTextureKey } from '../game/asset-registry';
import type { TileCoord } from '../game/tile-manager';

/** Why an option is disabled, phrased from the item's own footprint. */
function reason(error: PlacementError, itemType: string): string {
  if (error === 'INSUFFICIENT_FUNDS') return 'Not enough seeds';
  if (error === 'UNKNOWN_ITEM') return 'Unavailable';
  const f = footprintOf(itemType);
  return f.w * f.h > 1 ? `Needs ${f.w}×${f.h} free soil` : 'No room here';
}

/** Small popover anchored to an empty plot: the plot itself is the "shop". */
@Component({
  selector: 'app-plant-picker',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      #panel
      class="panel picker invisible absolute z-[25] grid grid-cols-4 gap-1 p-1.5 sm:grid-cols-6 short:grid-cols-7"
      role="menu"
      aria-label="Plant something here"
    >
      @for (opt of options(); track opt.item.id) {
        <button
          type="button"
          role="menuitem"
          class="flex w-16 flex-col items-center rounded-md px-0.5 py-0.5 enabled:hover:bg-sun/60 focus-visible:outline-2 focus-visible:outline-sun disabled:opacity-45"
          [disabled]="!!opt.reason"
          [attr.aria-label]="opt.item.name + ', ' + opt.item.price + ' seeds' + (opt.reason ? ', ' + opt.reason : '')"
          [title]="opt.reason ?? opt.item.name"
          (click)="picked.emit(opt.item.id)"
        >
          <img [src]="assets.url(preview(opt.item.id))" alt="" class="pixelated size-12 short:size-10" />
          <span class="text-xs font-extrabold">🌱 {{ opt.item.price }}</span>
          @if (opt.reason) { <span class="text-[10px] leading-tight">{{ opt.reason }}</span> }
        </button>
      }
    </div>
  `,
  styles: `
    .picker { animation: pop 160ms cubic-bezier(.2,1.4,.4,1); }
    @keyframes pop { from { opacity: 0; scale: .85; } }
  `,
})
export class PlantPickerComponent {
  protected readonly store = inject(GardenStore);
  protected readonly assets = inject(AssetService);
  readonly tile = input.required<TileCoord>();
  readonly picked = output<string>();
  readonly closed = output<void>();
  protected preview = (id: string) => previewTextureKey(id, 'MATURE');

  /** Each plant, and why it can't go here (if it can't). Re-evaluated as balance changes. */
  protected readonly options = computed(() =>
    this.store.catalog.map((item) => {
      const spot = this.store.placementFor(item.id, this.tile());
      return { item, reason: spot.ok ? null : reason(spot.error, item.id) };
    }),
  );

  private readonly panel = viewChild.required<ElementRef<HTMLDivElement>>('panel');

  constructor() {
    afterRenderEffect(() => this.place(this.tile()));
    const onResize = () => this.place(untracked(this.tile));
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
  }

  /**
   * Sit above the tile, or below it when there's more room there, nudged inward
   * near the sides; then clamp so the whole popover stays on screen and clear of
   * the HUD. Done in px because the room (and so the room for the popover) varies.
   */
  private place({ x, y }: TileCoord): void {
    const el = this.panel().nativeElement;
    const room = (el.offsetParent ?? document.body).getBoundingClientRect();
    // Layout size: unaffected by the pop-in animation's scale.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const tileTop = room.top + (rowPct(y) / 100) * room.height;
    const tileBottom = room.top + (rowPct(y + 1) / 100) * room.height;
    const cx = room.left + (colPct(x + 0.5) / 100) * room.width;

    const minTop = HUD_CLEARANCE;
    const maxBottom = window.innerHeight - EDGE;
    const spaceAbove = tileTop - GAP - minTop;
    const spaceBelow = maxBottom - (tileBottom + GAP);
    const above = spaceAbove >= h || spaceAbove >= spaceBelow;
    let top = above ? tileTop - GAP - h : tileBottom + GAP;
    top = Math.max(minTop, Math.min(top, maxBottom - h));

    const fx = x <= 3 ? 0.15 : x >= ROOM_COLS - 4 ? 0.85 : 0.5;
    let left = cx - w * fx;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - w));

    el.style.left = `${left - room.left}px`;
    el.style.top = `${top - room.top}px`;
    el.classList.remove('invisible');
  }
}

/** Space kept free under the HUD bar (it sits at top-2 and is ~3rem tall, like the tile info's top-14). */
const HUD_CLEARANCE = 56;
/** Minimum gap to the screen edges, and between the popover and its tile. */
const EDGE = 8;
const GAP = 4;
