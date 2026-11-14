import { Component, computed, inject, input, output } from '@angular/core';
import { GRID_SIZE } from '@garden/shared';
import { GardenStore } from '../garden.store';
import { spriteIcon } from '../game/plant-sprites';
import type { TileCoord } from '../game/tile-manager';

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
      @for (item of store.catalog; track item.id) {
        <button
          type="button"
          role="menuitem"
          class="flex w-16 flex-col items-center rounded-md px-1 py-1 enabled:hover:bg-sun/60 focus-visible:outline-2 focus-visible:outline-sun disabled:opacity-40"
          [disabled]="!store.canAfford(item.id)"
          [attr.aria-label]="item.name + ', ' + item.price + ' seeds'"
          [title]="item.name"
          (click)="picked.emit(item.id)"
        >
          <img [src]="icon(item.id)" alt="" class="pixelated size-10" />
          <span class="text-xs font-extrabold">🌱 {{ item.price }}</span>
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
  readonly tile = input.required<TileCoord>();
  readonly picked = output<string>();
  readonly closed = output<void>();
  protected icon = (id: string) => spriteIcon(id, 3);

  /** Sit above the tile (below it near the top edge), nudged inward near the sides. */
  protected readonly pos = computed(() => {
    const { x, y } = this.tile();
    const cell = 100 / GRID_SIZE;
    const above = y >= 3;
    const tx = x <= 2 ? '-20%' : x >= GRID_SIZE - 3 ? '-80%' : '-50%';
    return {
      left: (x + 0.5) * cell,
      top: above ? y * cell : (y + 1) * cell,
      transform: `translate(${tx}, ${above ? 'calc(-100% - 4px)' : '4px'})`,
    };
  });
}
