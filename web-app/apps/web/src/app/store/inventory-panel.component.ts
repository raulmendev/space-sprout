import { Component, computed, inject } from '@angular/core';
import { STORE_ITEMS, StoreItem, getCatalogItem, owned } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { AssetService } from '../shared/assets.service';
import { previewTextureKey } from '../garden/game/asset-registry';

/** Inventory groups, each with where its things get used. */
const GROUPS: readonly { title: string; hint: string; has: (i: StoreItem) => boolean }[] = [
  { title: 'Seed packets', hint: 'Tap any empty soil in the Garden to plant one.', has: (i) => !!i.plant },
  { title: 'Supplies', hint: "Use from a plant's close-up.", has: (i) => i.section === 'GARDEN' && !i.plant },
  { title: 'Messages', hint: 'Write one on the Message Board in the Social Space.', has: (i) => i.section === 'MESSAGES' },
  { title: 'Decorations', hint: 'Yours to keep. Placing them in the station comes soon.', has: (i) => i.section === 'DECORATIONS' },
];

/**
 * The household's shared inventory, opened from the backpack in the top bar:
 * everything bought at the Supply Store and not used up yet, grouped by where
 * it gets used.
 */
@Component({
  selector: 'app-inventory-panel',
  host: { class: 'console-screen flex min-h-0 flex-1 flex-col gap-3 short:gap-2' },
  template: `
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0.5">
      @for (g of groups(); track g.title) {
        <section class="mb-3 last:mb-0 short:mb-2" [attr.aria-label]="g.title">
          <h3 class="flex flex-wrap items-baseline gap-x-2 font-extrabold">
            {{ g.title }}
            <span class="text-xs font-normal text-bark/70">{{ g.items.length ? g.hint : 'None yet. The Supply Store in the Social Space has some.' }}</span>
          </h3>
          @if (g.items.length) {
            <ul class="mt-1.5 grid grid-cols-2 gap-2 @lg:grid-cols-3 short:gap-1.5 short:@lg:grid-cols-2">
              @for (row of g.items; track row.item.id) {
                <li class="riveted-card flex items-center gap-2.5 px-3 py-2 short:py-1.5">
                  <span class="sprite" aria-hidden="true">
                    @if (row.item.plant) {
                      <img [src]="assets.url(preview(row.item.plant))" alt="" [class.pixelated]="!assets.has(preview(row.item.plant))" />
                    } @else {
                      <span class="icon">{{ row.item.icon }}</span>
                    }
                  </span>
                  <span class="min-w-0 flex-1 truncate font-bold leading-tight" [title]="row.item.name">{{ row.label }}</span>
                  <span class="shrink-0 text-lg font-extrabold" [attr.aria-label]="row.count + ' owned'">×{{ row.count }}</span>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>

    @if (garden.recentPurchases()) {
      <p class="truncate text-xs text-bark/70">Recently bought: {{ garden.recentPurchases() }}</p>
    }
  `,
  styles: `
    .sprite {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 3rem;
      height: 3rem;
      border: 2px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--color-parchment) 70%, #fff);
    }
    .sprite img { width: 2.6rem; height: 2.6rem; object-fit: contain; }
    .sprite .icon { font-size: 1.5rem; line-height: 1; }
    @media (max-height: 500px) {
      .sprite { width: 2.5rem; height: 2.5rem; }
      .sprite img { width: 2.1rem; height: 2.1rem; }
      .sprite .icon { font-size: 1.25rem; }
    }
  `,
})
export class InventoryPanelComponent {
  protected readonly garden = inject(GardenStore);
  protected readonly assets = inject(AssetService);

  /** Owned items (count > 0) per group, in store order. */
  protected readonly groups = computed(() => {
    const inv = this.garden.inventory();
    return GROUPS.map((g) => ({
      ...g,
      items: STORE_ITEMS.filter(g.has)
        // Under "Seed packets", the plant's name is enough ("Wildflower", not "Wildflower seeds").
        .map((item) => ({ item, label: item.plant ? (getCatalogItem(item.plant)?.name ?? item.name) : item.name, count: owned(inv, item.id) }))
        .filter((r) => r.count > 0),
    }));
  });


  protected preview = (plant: string) => previewTextureKey(plant, 'MATURE');
}
