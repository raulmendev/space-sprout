import { Component, DestroyRef, computed, inject, signal, untracked } from '@angular/core';
import { failureText } from '../garden/failure-text';
import { STORE_ITEMS, STORE_SECTIONS, StoreItem, StoreSection, owned } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from '../habitat/habitat.store';
import { AssetService } from '../shared/assets.service';
import { moreSeeds, seeds } from '../shared/format';
import { t } from '../i18n/i18n';

/**
 * "Purchasing…" lasts at least this long (ms). A local purchase finishes instantly, so without it
 * the second click of a double-click would start a second purchase.
 */
const MIN_PURCHASING_MS = 450;

/** Result of the last purchase, shown in the balance strip. `itemId` only when it worked. */
interface Feedback {
  itemId?: string;
  text: string;
}

/** Where the thing just bought gets used, so the purchase leads somewhere. */
function boughtText(item: StoreItem): string {
  if (item.plant) return t('Purchased! Ready to plant in the Garden.');
  return t('{name} added to your inventory.', { name: t(item.name) });
}

/**
 * The Supply Store: spend seeds on seed packets, fertilizer and decorations.
 * Everything goes into the household's shared inventory; planting and
 * fertilizing use it up. Drawn as the cream screen inside the station's steel
 * console frame, like the Medical Terminal.
 */
@Component({
  selector: 'app-store-panel',
  // min-h-0 flex-1: fill the popup's fixed height, so the catalog (not the whole popup) scrolls.
  host: { class: 'console-screen flex min-h-0 flex-1 flex-col gap-3 short:gap-2' },
  template: `
    <div class="strip">
      <p class="flex shrink-0 items-baseline gap-1.5">
        <span class="text-xl leading-none short:text-lg" aria-hidden="true">🌱</span>
        <b class="text-2xl leading-none short:text-xl">{{ garden.balance() }}</b>
        <span class="font-bold">{{ t('seeds to spend') }}</span>
      </p>
      <span class="divider" aria-hidden="true"></span>
      <!-- One line, three uses: the last purchase's result, the household's recent buys, or how to earn more. -->
      <p class="min-w-0 flex-1 truncate text-sm" role="status" [class.text-alert]="feedback() && !feedback()!.itemId" [class.font-bold]="!!feedback()">
        @if (feedback(); as f) {
          {{ f.itemId ? '✓ ' : '' }}{{ f.text }}
        } @else if (garden.recentPurchases()) {
          <span class="text-bark/70">{{ t('Recently: {list}', { list: garden.recentPurchases() }) }}</span>
        } @else {
          <span class="text-bark/70">{{ t('Earn more with check-ins at the Medical Terminal.') }}</span>
        }
      </p>
    </div>

    <div role="tablist" [attr.aria-label]="t('Store sections')" class="grid grid-cols-3 gap-2">
      @for (s of sections; track s.id) {
        <button type="button" role="tab" class="console-tab btn-press" [attr.aria-selected]="section() === s.id" (click)="section.set(s.id)">
          <span aria-hidden="true">{{ s.icon }}</span>{{ t(s.title) }}
        </button>
      }
    </div>

    <ul class="catalog grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overscroll-contain p-0.5 @lg:grid-cols-2" role="tabpanel" [attr.aria-label]="sectionTitle()">
      @for (item of items(); track item.id) {
        @let have = count(item.id);
        @let missing = item.price - garden.balance();
        <li class="riveted-card card" [class.bumped]="feedback()?.itemId === item.id">
          <span class="sprite" aria-hidden="true">
            @if (assets.itemSprite(item.id, item.plant); as sprite) {
              <img [src]="sprite.url" alt="" [class.pixelated]="sprite.pixelated" />
            } @else {
              <span class="icon">{{ item.icon }}</span>
            }
          </span>
          <div class="min-w-0 flex-1">
            <p class="name font-extrabold leading-tight">{{ t(item.name) }}</p>
            <!-- On short screens a one-line cut ("A cheerful pi…") says nothing; the name and sprite carry it. -->
            <p class="desc line-clamp-2 short:hidden">{{ t(item.description) }}</p>
            @if (missing > 0) {
              <p class="text-xs font-bold text-alert">{{ t('Need {more}', { more: moreSeeds(missing) }) }}</p>
            } @else {
              <p class="owned text-xs font-bold" [class.text-leaf-dark]="have > 0">{{ t('Owned: {n}', { n: have }) }}</p>
            }
          </div>
          <button
            type="button"
            class="buy btn-press"
            [disabled]="missing > 0 || !!purchasing()"
            [attr.aria-label]="buyLabel(item, missing)"
            (click)="buy(item)"
          >
            <span class="price"><span aria-hidden="true">🌱</span>{{ item.price }}</span>
            <span class="action">{{ purchasing() === item.id ? t('Purchasing…') : missing > 0 ? t('Need {n} more', { n: missing }) : t('Buy') }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .strip {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.9rem;
      border: 2px solid var(--line);
      border-radius: 10px;
      background: #fffaf0;
    }
    .divider { align-self: stretch; width: 2px; background: var(--line); }

    .card { display: flex; align-items: center; gap: 0.75rem; padding: 10px 12px; }
    .sprite {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 4rem;
      height: 4rem;
      border: 2px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--color-parchment) 70%, #fff);
    }
    .sprite img { width: 3.5rem; height: 3.5rem; object-fit: contain; }
    .sprite .icon { font-size: 2rem; line-height: 1; }
    /* One line where the description shows; on short screens (no description) up to two, always two tall. */
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Always two lines tall, so every card is the same height whatever its copy. */
    .desc { min-height: 2.5em; font-size: 0.8rem; line-height: 1.25; color: color-mix(in srgb, var(--color-bark-dark) 75%, transparent); }

    /* Price on top, action below: clearly two things, one big target (at least 44 × 44). */
    .buy {
      --press: var(--color-bark-dark);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      min-width: 4.5rem;
      min-height: 3.25rem;
      padding: 0.25rem 0.6rem;
      background: var(--color-sun);
      font-weight: 800;
    }
    .buy .price { display: flex; align-items: center; gap: 2px; font-size: 1.15rem; line-height: 1.1; }
    .buy .action { font-size: 0.75rem; }
    .buy:enabled:hover { filter: brightness(1.04); }
    .buy:disabled { --press: color-mix(in srgb, var(--color-bark) 25%, transparent); background: var(--color-parchment); color: color-mix(in srgb, var(--color-bark-dark) 55%, transparent); }

    /* Just bought: the owned count pops once. */
    .bumped .owned { animation: bump 450ms cubic-bezier(.2, 1.6, .4, 1); transform-origin: left center; }
    @keyframes bump { 40% { scale: 1.35; } }
    @media (prefers-reduced-motion: reduce) { .bumped .owned { animation: none; } }

    /* Same breakpoint as the short: variant in styles.css: compact to fit landscape phones. */
    @media (max-height: 500px) {
      .strip { padding: 0.25rem 0.75rem; }
      .card { padding: 6px 10px; gap: 0.6rem; }
      .name { display: -webkit-box; min-height: 2.5em; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .sprite { width: 3rem; height: 3rem; }
      .sprite img { width: 2.6rem; height: 2.6rem; }
      .sprite .icon { font-size: 1.5rem; }
      .buy { min-height: 2.75rem; min-width: 4rem; }
    }
  `,
})
export class StorePanelComponent {
  protected readonly garden = inject(GardenStore);
  protected readonly assets = inject(AssetService);
  protected readonly sections = STORE_SECTIONS;
  /** Opens on the tab another panel asked for (the board sends you to Messages), else Gardening. */
  protected readonly section = signal<StoreSection>(startTab(inject(HabitatStore)));
  /** The item being bought right now: every Buy is disabled until it settles, so nothing is bought twice. */
  protected readonly purchasing = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  protected readonly items = computed(() => STORE_ITEMS.filter((i) => i.section === this.section()));
  protected readonly sectionTitle = computed(() => t(STORE_SECTIONS.find((s) => s.id === this.section())!.title));
  protected readonly t = t;


  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.feedbackTimer));
  }

  protected count = (id: string) => owned(this.garden.inventory(), id);
  protected moreSeeds = moreSeeds;

  protected buyLabel(item: StoreItem, missing: number): string {
    const name = t(item.name);
    if (this.purchasing() === item.id) return t('Purchasing {name}…', { name });
    const buy = t('Buy {name} for {price}', { name, price: seeds(item.price) });
    return missing > 0 ? t('{buy}, need {more}', { buy, more: moreSeeds(missing) }) : buy;
  }

  protected async buy(item: StoreItem): Promise<void> {
    if (this.purchasing()) return;
    this.purchasing.set(item.id);
    const settled = new Promise((r) => setTimeout(r, MIN_PURCHASING_MS));
    clearTimeout(this.feedbackTimer);
    this.feedback.set(null);
    try {
      const error = await this.garden.buy(item.id);
      if (error === 'INSUFFICIENT_FUNDS') this.feedback.set({ text: t('Need {more}.', { more: moreSeeds(item.price - this.garden.balance()) }) });
      else if (error) this.feedback.set({ text: failureText({ UNKNOWN_ITEM: 'Currently unavailable.' }, error) });
      else this.feedback.set({ itemId: item.id, text: boughtText(item) });
    } catch {
      // Nothing was saved, so nothing was charged: just let them try again.
      this.feedback.set({ text: t("Purchase couldn't be completed. Try again.") });
    } finally {
      await settled;
      this.purchasing.set(null);
    }
    if (this.feedback()?.itemId) this.feedbackTimer = setTimeout(() => this.feedback.set(null), 4000);
  }
}

function startTab(habitat: HabitatStore): StoreSection {
  const tab = untracked(habitat.panelTab);
  habitat.panelTab.set(null);
  return STORE_SECTIONS.find((s) => s.id === tab)?.id ?? 'GARDEN';
}
