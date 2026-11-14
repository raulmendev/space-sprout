import { Component, computed, inject, input, output } from '@angular/core';
import { HABITAT_COLS, PlacementError, footprintOf } from '@garden/shared';
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
      class="panel picker absolute z-10 flex gap-1 p-1.5"
      [style.left.%]="pos().left"
      [style.top.%]="pos().top"
      [style.transform]="pos().transform"
      role="menu"
      aria-label="Plant something here"
    >
      @for (opt of options(); track opt.item.id) {
        <button
          type="button"
          role="menuitem"
          class="flex w-20 flex-col items-center rounded-md px-1 py-1 enabled:hover:bg-sun/60 focus-visible:outline-2 focus-visible:outline-sun disabled:opacity-45"
          [disabled]="!!opt.reason"
          [attr.aria-label]="opt.item.name + ', ' + opt.item.price + ' seeds' + (opt.reason ? ', ' + opt.reason : '')"
          [title]="opt.reason ?? opt.item.name"
          (click)="picked.emit(opt.item.id)"
        >
          <img [src]="assets.url(preview(opt.item.id))" alt="" class="pixelated size-16" />
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

  /** Sit above the tile (below it near the top edge), nudged inward near the sides. */
  protected readonly pos = computed(() => {
    const { x, y } = this.tile();
    const above = y >= 5;
    const tx = x <= 3 ? '-15%' : x >= HABITAT_COLS - 4 ? '-85%' : '-50%';
    return {
      left: colPct(x + 0.5),
      top: rowPct(above ? y : y + 1),
      transform: `translate(${tx}, ${above ? 'calc(-100% - 4px)' : '4px'})`,
    };
  });
}
