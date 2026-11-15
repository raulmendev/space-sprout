import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { STORE_ITEMS, STORE_SECTIONS, StoreItem, StoreSection, getStoreItem, owned } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { LOCAL_PLAYER } from '../garden/garden.service';
import { AssetService } from '../shared/assets.service';
import { moreSeeds, seeds } from '../shared/format';
import { previewTextureKey } from '../garden/game/asset-registry';
import { timeAgo } from '../health/format';

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
  if (item.plant) return 'Purchased! Ready to plant in the Garden.';
  return `${item.name} added to your inventory.`;
}

/**
 * The Supply Store: spend seeds on seed packets, fertilizer and decorations.
 * Everything goes into the household's shared inventory; planting and
 * fertilizing use it up. Drawn as the cream screen inside the station's steel
 * console frame, like the Medical Terminal.
 */
@Component({
  selector: 'app-store-panel',
  // min-h-0: shrink to the popup's height, so the catalog (not the whole popup) scrolls.
  host: { class: 'console-screen flex min-h-0 flex-col gap-3 short:gap-2' },
  template: `
    <div class="strip">
      <p class="flex shrink-0 items-baseline gap-1.5">
        <span class="text-xl leading-none short:text-lg" aria-hidden="true">🌱</span>
        <b class="text-2xl leading-none short:text-xl">{{ garden.balance() }}</b>
        <span class="font-bold">seeds to spend</span>
      </p>
      <span class="divider" aria-hidden="true"></span>
      <!-- One line, three uses: the last purchase's result, the household's recent buys, or how to earn more. -->
      <p class="min-w-0 flex-1 truncate text-sm" role="status" [class.text-alert]="feedback() && !feedback()!.itemId" [class.font-bold]="!!feedback()">
        @if (feedback(); as f) {
          {{ f.itemId ? '✓ ' : '' }}{{ f.text }}
        } @else if (recent()) {
          <span class="text-bark/70">Recently: {{ recent() }}</span>
        } @else {
          <span class="text-bark/70">Earn more with check-ins at the Medical Terminal.</span>
        }
      </p>
    </div>

    <div role="tablist" aria-label="Store sections" class="grid grid-cols-3 gap-2">
      @for (s of sections; track s.id) {
        <button type="button" role="tab" class="console-tab btn-press" [attr.aria-selected]="section() === s.id" (click)="section.set(s.id)">
          <span aria-hidden="true">{{ s.icon }}</span>{{ s.title }}
        </button>
      }
    </div>

    <ul class="catalog grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain p-0.5 @lg:grid-cols-2" role="tabpanel" [attr.aria-label]="sectionTitle()">
      @for (item of items(); track item.id) {
        @let have = count(item.id);
        @let missing = item.price - garden.balance();
        <li class="riveted-card card" [class.bumped]="feedback()?.itemId === item.id">
          <span class="sprite" aria-hidden="true">
            @if (item.plant) {
              <img [src]="assets.url(preview(item.plant))" alt="" [class.pixelated]="!assets.has(preview(item.plant))" />
            } @else {
              <span class="icon">{{ item.icon }}</span>
            }
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-extrabold leading-tight">{{ item.name }}</p>
            <!-- On short screens a one-line cut ("A cheerful pi…") says nothing; the name and sprite carry it. -->
            <p class="desc line-clamp-2 short:hidden">{{ item.description }}</p>
            @if (missing > 0) {
              <p class="text-xs font-bold text-alert">Need {{ moreSeeds(missing) }}</p>
            } @else {
              <p class="owned text-xs font-bold" [class.text-leaf-dark]="have > 0">Owned: {{ have }}</p>
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
            <span class="action">{{ purchasing() === item.id ? 'Purchasing…' : missing > 0 ? 'Need ' + missing + ' more' : 'Buy' }}</span>
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
    .desc { font-size: 0.8rem; line-height: 1.25; color: color-mix(in srgb, var(--color-bark-dark) 75%, transparent); }

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
  protected readonly section = signal<StoreSection>('GARDEN');
  /** The item being bought right now: every Buy is disabled until it settles, so nothing is bought twice. */
  protected readonly purchasing = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  protected readonly items = computed(() => STORE_ITEMS.filter((i) => i.section === this.section()));
  protected readonly sectionTitle = computed(() => STORE_SECTIONS.find((s) => s.id === this.section())!.title);

  /** Recent purchases by anyone in the household: "You: Fertilizer (2 min ago) · Family: Photo frame (1 h ago)". */
  protected readonly recent = computed(() =>
    this.garden
      .purchases()
      .map((p) => `${p.by === LOCAL_PLAYER.id ? 'You' : p.byName}: ${getStoreItem(p.itemId)?.name ?? p.itemId} (${timeAgo(p.at)})`)
      .join(' · '),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.feedbackTimer));
  }

  protected count = (id: string) => owned(this.garden.inventory(), id);
  protected preview = (plant: string) => previewTextureKey(plant, 'MATURE');
  protected moreSeeds = moreSeeds;

  protected buyLabel(item: StoreItem, missing: number): string {
    if (this.purchasing() === item.id) return `Purchasing ${item.name}…`;
    return `Buy ${item.name} for ${seeds(item.price)}` + (missing > 0 ? `, need ${moreSeeds(missing)}` : '');
  }

  protected async buy(item: StoreItem): Promise<void> {
    if (this.purchasing()) return;
    this.purchasing.set(item.id);
    const settled = new Promise((r) => setTimeout(r, MIN_PURCHASING_MS));
    clearTimeout(this.feedbackTimer);
    this.feedback.set(null);
    try {
      const error = await this.garden.buy(item.id);
      if (error === 'UNKNOWN_ITEM') this.feedback.set({ text: 'Currently unavailable.' });
      else if (error === 'INSUFFICIENT_FUNDS') this.feedback.set({ text: `Need ${moreSeeds(item.price - this.garden.balance())}.` });
      else this.feedback.set({ itemId: item.id, text: boughtText(item) });
    } catch {
      // Nothing was saved, so nothing was charged: just let them try again.
      this.feedback.set({ text: "Purchase couldn't be completed. Try again." });
    } finally {
      await settled;
      this.purchasing.set(null);
    }
    if (this.feedback()?.itemId) this.feedbackTimer = setTimeout(() => this.feedback.set(null), 4000);
  }
}
