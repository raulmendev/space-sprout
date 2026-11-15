import { Component, computed, inject, signal } from '@angular/core';
import { STORE_ITEMS, STORE_SECTIONS, StoreItem, StoreSection, getStoreItem, owned } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { LOCAL_PLAYER } from '../garden/garden.service';
import { AssetService } from '../shared/assets.service';
import { previewTextureKey } from '../garden/game/asset-registry';
import { timeAgo } from '../health/format';

/**
 * The Supply Store: spend seeds on seed packets, fertilizer and decorations.
 * Everything goes into the household's shared inventory; planting and
 * fertilizing use it up. Shows who bought what, since it's one shared balance.
 */
@Component({
  selector: 'app-store-panel',
  host: { class: 'flex flex-col gap-3 short:gap-2' },
  template: `
    <div class="flex items-center gap-3 rounded-lg bg-parchment/70 px-3 py-1.5 short:py-1">
      <span class="shrink-0 text-lg font-extrabold short:text-base">🌱 {{ garden.balance() }} <span class="text-sm font-bold">seeds to spend</span></span>
      <!-- One line, three uses: what was just bought, the household's recent buys, or how to earn more. -->
      <span class="min-w-0 flex-1 truncate text-xs text-bark/70" role="status">
        @if (justBought(); as name) {
          <b class="text-leaf-dark">Bought {{ name }}! It's in the shared inventory.</b>
        } @else if (recent().length) {
          Recently: {{ recent() }}
        } @else {
          Earn more with check-ins at the Medical Terminal.
        }
      </span>
    </div>

    <div role="tablist" aria-label="Store sections" class="flex gap-1 rounded-lg bg-parchment p-1 text-sm font-bold">
      @for (s of sections; track s.id) {
        <button
          type="button"
          role="tab"
          class="flex-1 rounded-md px-2 py-1 short:py-0.5"
          [class.bg-cream]="section() === s.id"
          [attr.aria-selected]="section() === s.id"
          (click)="section.set(s.id)"
        ><span class="mr-1" aria-hidden="true">{{ s.icon }}</span>{{ s.title }}</button>
      }
    </div>

    <ul class="grid gap-2 @lg:grid-cols-2 short:gap-1.5" role="tabpanel" [attr.aria-label]="sectionTitle()">
      @for (item of items(); track item.id) {
        @let have = count(item.id);
        @let short = item.price - garden.balance();
        <li class="flex items-center gap-2.5 rounded-lg border-2 border-bark/15 bg-cream p-2 short:p-1.5">
          <span class="grid size-12 shrink-0 place-items-center rounded-md bg-parchment/70 short:size-10" aria-hidden="true">
            @if (item.plant) {
              <img [src]="assets.url(preview(item.plant))" alt="" class="pixelated size-11 object-contain short:size-9" />
            } @else {
              <span class="text-2xl short:text-xl">{{ item.icon }}</span>
            }
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold leading-tight">{{ item.name }}</p>
            <p class="truncate text-xs text-bark/70 short:hidden">{{ item.description }}</p>
            <p class="text-xs font-bold" [class.text-leaf-dark]="have > 0" [class.text-bark/60]="!have">
              {{ have ? 'You have ' + have : 'None yet' }}
            </p>
          </div>
          <button
            type="button"
            class="flex shrink-0 flex-col items-center rounded-md border-2 border-bark-dark bg-sun px-2.5 py-1 text-sm font-extrabold enabled:hover:brightness-105 disabled:border-bark/30 disabled:bg-parchment disabled:text-bark/60"
            [disabled]="short > 0"
            [attr.aria-label]="'Buy ' + item.name + ' for ' + item.price + ' seeds' + (short > 0 ? ', need ' + short + ' more' : '')"
            (click)="buy(item)"
          >
            <span>🌱 {{ item.price }}</span>
            <span class="text-[10px] font-bold leading-none">{{ short > 0 ? 'Need ' + short + ' more' : 'Buy' }}</span>
          </button>
        </li>
      }
    </ul>

  `,
})
export class StorePanelComponent {
  protected readonly garden = inject(GardenStore);
  protected readonly assets = inject(AssetService);
  protected readonly sections = STORE_SECTIONS;
  protected readonly section = signal<StoreSection>('GARDEN');
  protected readonly justBought = signal<string | null>(null);
  private justBoughtTimer?: ReturnType<typeof setTimeout>;

  protected readonly items = computed(() => STORE_ITEMS.filter((i) => i.section === this.section()));
  protected readonly sectionTitle = computed(() => STORE_SECTIONS.find((s) => s.id === this.section())!.title);

  /** The last few purchases by anyone in the household: "You: Fertilizer (2 min ago) · Family: Photo frame (1 h ago)". */
  protected readonly recent = computed(() =>
    this.garden
      .purchases()
      .slice(0, 3)
      .map((p) => `${p.by === LOCAL_PLAYER.id ? 'You' : p.byName}: ${getStoreItem(p.itemId)?.name ?? p.itemId} (${timeAgo(p.at)})`)
      .join(' · '),
  );

  protected count = (id: string) => owned(this.garden.inventory(), id);
  protected preview = (plant: string) => previewTextureKey(plant, 'MATURE');

  protected async buy(item: StoreItem): Promise<void> {
    if (await this.garden.buy(item.id)) return;
    clearTimeout(this.justBoughtTimer);
    this.justBought.set(item.name);
    this.justBoughtTimer = setTimeout(() => this.justBought.set(null), 2500);
  }
}
