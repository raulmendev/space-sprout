import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { plantStages, type CareAction, type CareCheck, type CareEvent, type PlantStage } from '@garden/shared';
import type { CloseupInfo } from '../garden.store';
import { CLOSEUP_GEOMETRY as G } from '../game/closeup-art';
import { PREVIEW_SOIL, closeupHasSoil, glowPreviewTextureKey, previewTextureKey } from '../game/asset-registry';
import { AssetService } from '../../shared/assets.service';

const SCALE = 3; // integer scale keeps pixels crisp
const SOIL_OVERFLOW = 12;
const ACTIONS: { id: CareAction; label: string; icon: string }[] = [
  { id: 'WATER', label: 'Water', icon: '💧' },
  { id: 'FERTILIZE', label: 'Fertilize', icon: '✨' },
  { id: 'PRUNE', label: 'Prune', icon: '✂️' },
  { id: 'HARVEST', label: 'Harvest', icon: '🧺' },
];
const PAST: Record<CareAction, string> = { WATER: 'Watered', FERTILIZE: 'Fertilized', PRUNE: 'Pruned', HARVEST: 'Harvested' };
const BLOCKED: Record<string, string> = {
  ALREADY_MATURE: 'Fully grown',
  TOO_YOUNG: 'Too young',
  NOT_MATURE: 'Not ready',
  INSUFFICIENT_FUNDS: 'Need more seeds',
};

const STAGE_LABELS: Record<PlantStage, string> = { SEED: 'Seed', SPROUT: 'Sprout', GROWING: 'Growing', BUD: 'Bud', MATURE: 'Grown' };

/** Close-up of one plant: the "pretty" version of the 16px garden sprite. */
@Component({
  selector: 'app-plant-closeup',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="absolute inset-0 z-20 flex items-center justify-center bg-night/45 p-3" (click)="closed.emit()">
      <div
        class="panel card relative w-[360px] max-w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="info().item.name + ' close-up'"
        (click)="$event.stopPropagation()"
      >
        <div class="scene relative overflow-hidden" [style.height.px]="sceneH">
          @if (!ownSoil()) {
            <img [src]="soil" alt="" class="pixelated absolute left-1/2 -translate-x-1/2" [style.width.px]="soilW" [style.bottom.px]="-soilOverflow" />
          }
          <img
              #plantImg
              [src]="plant()"
              [alt]="info().item.name"
              class="plant pixelated absolute left-1/2"
              [class.still]="ownSoil()"
              [style.width.px]="plantW"
              [style.bottom.px]="ownSoil() ? 0 : plantBottom"
            />
          @if (fx(); as f) {
            @for (p of particles; track $index) {
              <span class="fx" [class]="'fx fx-' + f.action" [style.left.%]="p.x" [style.top.%]="p.y" [style.animation-delay.ms]="p.d"></span>
            }
          }
          @if (info().stage === 'MATURE') {
            @for (s of sparkles; track $index) {
              <span class="sparkle" [style.left.%]="s.x" [style.top.%]="s.y" [style.animation-delay.ms]="s.d"></span>
            }
          }
        </div>

        <div class="space-y-3 p-4 pt-3">
          <div>
            <h2 class="font-pixel text-2xl leading-none">{{ info().item.name }}</h2>
            <p class="mt-1 text-sm text-bark">{{ info().item.description }}</p>
          </div>

          <ol class="flex items-center gap-1 text-xs font-bold" aria-label="Growth">
            @for (s of stages(); track s.id; let last = $last) {
              <li
                class="rounded-full px-2 py-0.5"
                [class]="reached(s.id) ? 'bg-leaf text-cream' : 'bg-parchment text-bark/60'"
                [attr.aria-current]="info().stage === s.id ? 'step' : null"
              >
                {{ stageLabel(s) }}
              </li>
              @if (!last) { <li aria-hidden="true" class="text-bark/40">›</li> }
            }
          </ol>

          @if (info().msToMature > 0) {
            <div>
              <div class="h-2.5 overflow-hidden rounded-full border-2 border-bark-dark bg-parchment">
                <div class="h-full bg-leaf transition-[width] duration-1000 ease-linear" [style.width.%]="info().progress * 100"></div>
              </div>
              <p class="mt-1 text-sm">Fully grown in {{ countdown() }}</p>
            </div>
          } @else {
            <p class="text-sm font-bold text-leaf-dark">Fully grown and happy.</p>
          }
          <p class="text-sm" [class]="info().thirsty ? 'font-bold text-sky-700' : 'text-bark'">
            {{ info().thirsty ? '💧 Thirsty. A drink would help.' : '💧 Watered ' + ago(info().object.care?.lastWateredAt) }}
          </p>

          <div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Care">
            @for (a of actions; track a.id) {
              @let c = info().actions[a.id];
              <button
                type="button"
                class="flex flex-col items-center rounded-lg border-2 px-1 py-1.5 text-xs font-bold transition enabled:hover:-translate-y-0.5 disabled:opacity-45"
                [class]="confirming() && a.id === 'HARVEST' ? 'border-sun bg-sun/30' : 'border-bark-dark bg-parchment'"
                [disabled]="!c.ok"
                [attr.aria-label]="(confirming() && a.id === 'HARVEST' ? 'Confirm harvest' : a.label) + (hint(c) ? ', ' + hint(c) : '')"
                (click)="act(a.id)"
              >
                <span class="text-lg leading-none" aria-hidden="true">{{ a.icon }}</span>
                <span>{{ confirming() && a.id === 'HARVEST' ? 'Sure?' : a.label }}</span>
                <span class="font-normal text-bark/70">{{ hint(c) || '&nbsp;' }}</span>
              </button>
            }
          </div>
          @if (confirming()) {
            <p class="text-xs text-bark">Harvesting frees the plot. Tap again to confirm.</p>
          }
          @if (info().capReached) {
            <p class="text-xs text-bark/70">You've collected today's garden seeds. Care still helps it grow.</p>
          }

          <div class="border-t-2 border-parchment pt-2 text-xs text-bark/80">
            <p>Planted by {{ who(info().object.placedBy, info().object.placedByName) }} · {{ planted() }}</p>
            @for (e of recent(); track e.at) {
              <p>{{ past(e) }} by {{ who(e.by, e.byName) }} · {{ ago(e.at) }}</p>
            }
          </div>
        </div>

        <button
          type="button"
          class="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-cream/80 font-bold hover:bg-cream"
          aria-label="Close"
          (click)="closed.emit()"
        >✕</button>
      </div>
    </div>
  `,
  styles: `
    .card { animation: zoom 260ms cubic-bezier(.2,1.3,.4,1); }
    @keyframes zoom { from { opacity: 0; scale: .7; } }

    .scene {
      background:
        radial-gradient(circle at 82% 20%, #fff8c8 0 18px, rgb(255 248 200 / .35) 19px 34px, transparent 35px),
        radial-gradient(ellipse 65% 34% at 10% 82%, #8cc86f 0 98%, transparent 100%),
        radial-gradient(ellipse 70% 36% at 92% 84%, #79b863 0 98%, transparent 100%),
        linear-gradient(#b9e2f3 0%, #e4f4e2 62%, #a9d488 62%);
    }

    .plant {
      transform-origin: 50% 100%;
      animation: sway 4.5s ease-in-out infinite;
      translate: -50% 0;
    }
    /* Art with its own soil mound: rocking it would rock the ground too. */
    .plant.still {
      animation: none;
    }
    @keyframes sway { 0%, 100% { rotate: -1.2deg; } 50% { rotate: 1.2deg; } }

    .fx { position: absolute; width: 6px; height: 6px; opacity: 0; pointer-events: none; }
    .fx-WATER { background: #5fb7e8; border-radius: 0 50% 50% 50%; rotate: 45deg; animation: drip 800ms ease-in forwards; }
    .fx-FERTILIZE { background: #c6f07a; box-shadow: 0 0 6px #c6f07a; animation: rise 900ms ease-out forwards; }
    .fx-PRUNE { background: #6aa84f; width: 7px; height: 4px; animation: fall 900ms ease-in forwards; }
    @keyframes drip { 0% { opacity: 1; translate: 0 -30px; } 100% { opacity: 0; translate: 0 50px; } }
    @keyframes rise { 0% { opacity: 0; translate: 0 20px; } 30% { opacity: 1; } 100% { opacity: 0; translate: 0 -40px; } }
    @keyframes fall { 0% { opacity: 1; translate: 0 0; rotate: 0deg; } 100% { opacity: 0; translate: 14px 60px; rotate: 160deg; } }

    .sparkle {
      position: absolute; width: 6px; height: 6px; background: #fff6b0;
      box-shadow: 0 0 6px #fff6b0; opacity: 0;
      animation: twinkle 2.6s ease-in-out infinite;
    }
    @keyframes twinkle {
      0% { opacity: 0; translate: 0 6px; }
      40% { opacity: 1; }
      100% { opacity: 0; translate: 0 -18px; }
    }
  `,
})
export class PlantCloseupComponent {
  readonly info = input.required<CloseupInfo>();
  readonly closed = output<void>();
  readonly care = output<CareAction>();

  protected readonly actions = ACTIONS;
  protected readonly particles = Array.from({ length: 8 }, (_, i) => ({ x: 30 + ((i * 37) % 40), y: 15 + ((i * 23) % 35), d: i * 60 }));
  protected readonly fx = signal<{ action: CareAction } | null>(null);
  protected readonly confirming = signal(false);
  private fxTimer?: ReturnType<typeof setTimeout>;
  private confirmTimer?: ReturnType<typeof setTimeout>;

  private readonly assets = inject(AssetService);
  protected readonly soil = this.assets.url(PREVIEW_SOIL);
  protected readonly soilOverflow = SOIL_OVERFLOW;
  protected readonly soilW = G.soilW * SCALE;
  protected readonly plantW = G.plantPx * SCALE;
  /** Soil overflows the bottom; plant base sits `plantBaseInSoil` px into the mound. */
  protected readonly plantBottom = -SOIL_OVERFLOW + (G.soilH - G.plantBaseInSoil) * SCALE;
  protected readonly sceneH = this.plantBottom + this.plantW + 12;
  protected readonly sparkles = [
    { x: 28, y: 18, d: 0 },
    { x: 68, y: 26, d: 700 },
    { x: 40, y: 8, d: 1300 },
    { x: 62, y: 52, d: 1900 },
    { x: 30, y: 46, d: 2300 },
  ];

  protected readonly plant = computed(() => {
    const { object, stage, thriving } = this.info();
    const glow = glowPreviewTextureKey(object.itemType, stage);
    return this.assets.url(thriving && this.assets.has(glow) ? glow : previewTextureKey(object.itemType, stage));
  });
  /** Delivered art that already stands in its own soil. */
  protected readonly ownSoil = computed(() => {
    const { object, stage } = this.info();
    return closeupHasSoil(object.itemType) && this.assets.has(previewTextureKey(object.itemType, stage));
  });
  protected readonly stages = computed(() => plantStages(this.info().item).map((id) => ({ id, label: STAGE_LABELS[id] })));
  private readonly plantImg = viewChild.required<ElementRef<HTMLImageElement>>('plantImg');

  constructor() {
    // Pop whenever the art changes (opening, or growing while open).
    effect(() => {
      this.plant();
      const el = untracked(this.plantImg).nativeElement;
      el.animate([{ scale: '0.55', opacity: 0.3 }, { scale: '1', opacity: 1 }], {
        duration: 520,
        easing: 'cubic-bezier(.2,1.5,.4,1)',
      });
    });
  }

  protected act(action: CareAction): void {
    if (action === 'HARVEST' && !this.confirming()) {
      this.confirming.set(true);
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirming.set(false), 4000);
      return;
    }
    this.confirming.set(false);
    if (action !== 'HARVEST') {
      clearTimeout(this.fxTimer);
      this.fx.set(null);
      // Next frame so repeated taps restart the animation.
      requestAnimationFrame(() => this.fx.set({ action }));
      this.fxTimer = setTimeout(() => this.fx.set(null), 1400);
    }
    this.care.emit(action);
  }

  /** Small line under each action: cost, payout, cooldown or why it's unavailable. */
  protected hint(c: CareCheck): string {
    if (c.error === 'COOLDOWN') return 'in ' + this.duration(c.readyInMs ?? 0);
    if (c.error) return BLOCKED[c.error] ?? '';
    if (c.cost) return `🌱 −${c.cost}`;
    if (c.reward) return `🌱 +${c.reward}`;
    return '';
  }

  protected readonly recent = computed(() => this.info().log.slice(0, 3));

  protected past(e: CareEvent): string {
    return PAST[e.action];
  }

  protected who(id: string | undefined, name: string | undefined): string {
    if (id && id === this.info().me) return 'you';
    return name ?? 'someone';
  }

  /** Relative time against the shared growth clock. */
  protected ago(iso: string | undefined): string {
    if (!iso) return 'never';
    const now = Date.parse(this.info().object.createdAt) + this.info().ageMs;
    const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
    return s < 60 ? 'just now' : this.duration(s * 1000) + ' ago';
  }

  private duration(ms: number): string {
    const m = Math.ceil(ms / 60_000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  }

  protected stageLabel(s: { id: PlantStage; label: string }): string {
    return this.info().item.stageLabels?.[s.id] ?? s.label;
  }

  protected reached(stage: PlantStage): boolean {
    const order = this.stages().map((s) => s.id);
    return order.indexOf(stage) <= order.indexOf(this.info().stage);
  }

  protected readonly countdown = computed(() => {
    const s = Math.ceil(this.info().msToMature / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  });

  protected readonly planted = computed(() => {
    const s = Math.floor(this.info().ageMs / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    const days = Math.floor(s / 86400);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  });
}
