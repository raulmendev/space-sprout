import { Component, computed, inject } from '@angular/core';
import { INVENTORY_ITEM_IDS, describeItem, getCatalogItem, getStoreItem, isDecor, owned, pottedPlantOf } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { AssetService } from '../shared/assets.service';
import { previewTextureKey, storeItemTextureKey } from '../garden/game/asset-registry';
import { DECOR_ROOM_NAMES, DecorStore } from '../decor/decor.store';
import { HabitatStore } from '../habitat/habitat.store';

interface Group {
  title: string;
  hint: string;
  /** Shown instead of `hint` when its things can't be placed in the room you're in. */
  awayHint?: string;
  /** Shown when the group is empty. Default: buy some at the store. */
  empty?: string;
  has: (itemId: string) => boolean;
}

const section = (itemId: string) => getStoreItem(itemId)?.section;

/** Inventory groups, each with where its things get used. */
const GROUPS: readonly Group[] = [
  { title: 'Seed packets', hint: 'Tap any empty soil in the Garden to plant one.', has: (id) => !!getStoreItem(id)?.plant },
  { title: 'Supplies', hint: "Use from a plant's close-up.", has: (id) => section(id) === 'GARDEN' && !getStoreItem(id)?.plant },
  { title: 'Messages', hint: 'Write one on the Message Board in the Social Space.', has: (id) => section(id) === 'MESSAGES' },
  {
    title: 'Potted plants',
    hint: 'Tap Place, then pick a spot on any floor.',
    empty: 'None yet. Pot a grown plant from its close-up (it uses a clay pot).',
    has: (id) => !!pottedPlantOf(id),
  },
  {
    title: 'Decorations',
    hint: 'Tap Place, then pick a spot in the room.',
    awayHint: `Place them from the ${DECOR_ROOM_NAMES}.`,
    has: (id) => section(id) === 'DECORATIONS',
  },
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
            <span class="text-xs font-normal text-bark/70">{{ g.items.length ? ((g.awayNow && g.awayHint) || g.hint) : (g.empty ?? 'None yet. The Supply Store in the Social Space has some.') }}</span>
          </h3>
          @if (g.items.length) {
            <ul class="mt-1.5 grid grid-cols-2 gap-2 @lg:grid-cols-3 short:gap-1.5 short:@lg:grid-cols-2">
              @for (row of g.items; track row.id) {
                <li class="riveted-card flex items-center gap-2.5 px-3 py-2 short:py-1.5">
                  <span class="sprite" aria-hidden="true">
                    @if (row.item.plant) {
                      <img [src]="assets.url(preview(row.item.plant))" alt="" [class.pixelated]="!assets.has(preview(row.item.plant))" />
                    } @else if (assets.has(art(row.id))) {
                      <img [src]="assets.url(art(row.id))" alt="" class="pixelated" />
                    } @else {
                      <span class="icon">{{ row.item.icon }}</span>
                    }
                  </span>
                  <span class="min-w-0 flex-1 leading-tight">
                    <span class="block truncate font-bold" [title]="row.item.name">{{ row.label }}</span>
                    @if (row.up) { <span class="block truncate text-xs text-bark/70">{{ row.up }} up in the station</span> }
                  </span>
                  @if (row.count) {
                    <span class="shrink-0 text-lg font-extrabold" [attr.aria-label]="row.count + ' owned'">×{{ row.count }}</span>
                  }
                  @if (row.placeable) {
                    <button
                      type="button"
                      class="btn-press shrink-0 bg-sun px-2 py-0.5 text-sm font-bold disabled:bg-parchment disabled:opacity-50"
                      [disabled]="!row.count || !row.placeHere"
                      [attr.aria-label]="'Place ' + row.item.name"
                      (click)="place(row.id)"
                    >Place</button>
                  }
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
  protected readonly decor = inject(DecorStore);
  private readonly habitat = inject(HabitatStore);

  /** Owned items (in the inventory, or placed in the station), grouped by where they get used. */
  protected readonly groups = computed(() => {
    const inv = this.garden.inventory();
    const up = new Map<string, number>();
    for (const d of this.garden.decorations()) up.set(d.itemId, (up.get(d.itemId) ?? 0) + 1);
    const rows = INVENTORY_ITEM_IDS.map((id) => {
      const item = describeItem(id);
      return {
        id,
        item,
        // Under "Seed packets" and "Potted plants", the plant's name is enough ("Wildflower", not "Wildflower seeds").
        label: item.plant ? (getCatalogItem(item.plant)?.name ?? item.name) : item.name,
        count: owned(inv, id),
        /** How many are up in the station (still the household's, so still listed). */
        up: up.get(id) ?? 0,
        placeable: isDecor(id),
        placeHere: this.decor.canPlaceHere(id),
      };
    }).filter((r) => r.count > 0 || r.up > 0);
    return GROUPS.map((g) => {
      const items = rows.filter((r) => g.has(r.id));
      return { ...g, items, awayNow: items.some((r) => r.placeable && !r.placeHere) };
    });
  });

  /** Close the inventory and start placing one in the room. */
  protected place(itemId: string): void {
    this.habitat.openPanel.set(null);
    this.decor.start(itemId);
  }


  protected preview = (plant: string) => previewTextureKey(plant, 'MATURE');
  protected art = storeItemTextureKey;
}
