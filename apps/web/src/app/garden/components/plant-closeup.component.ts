import { Component, ElementRef, computed, effect, input, output, untracked, viewChild } from '@angular/core';
import type { PlantStage } from '@garden/shared';
import type { CloseupInfo } from '../garden.store';
import { CLOSEUP_GEOMETRY as G, closeupPlantArt, closeupSoilArt } from '../game/closeup-art';

const SCALE = 4; // integer scale keeps pixels crisp
const STAGES: { id: PlantStage; label: string }[] = [
  { id: 'SEED', label: 'Seed' },
  { id: 'SPROUT', label: 'Sprout' },
  { id: 'MATURE', label: 'Grown' },
];

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
          <img [src]="soil" alt="" class="pixelated absolute left-1/2 -translate-x-1/2" [style.width.px]="soilW" [style.bottom.px]="-16" />
          <img
              #plantImg
              [src]="plant()"
              [alt]="info().item.name"
              class="plant pixelated absolute left-1/2"
              [style.width.px]="plantW"
              [style.bottom.px]="plantBottom"
            />
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
            @for (s of stages; track s.id; let last = $last) {
              <li
                class="rounded-full px-2 py-0.5"
                [class]="reached(s.id) ? 'bg-leaf text-cream' : 'bg-parchment text-bark/60'"
                [attr.aria-current]="info().stage === s.id ? 'step' : null"
              >
                {{ s.label }}
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
          <p class="text-xs text-bark/70">Planted {{ planted() }}</p>
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
    @keyframes sway { 0%, 100% { rotate: -1.2deg; } 50% { rotate: 1.2deg; } }

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

  protected readonly stages = STAGES;
  protected readonly soil = closeupSoilArt();
  protected readonly soilW = G.soilW * SCALE;
  protected readonly plantW = G.plantPx * SCALE;
  /** Soil overflows the bottom by 16px; plant base sits `plantBaseInSoil` px into the mound. */
  protected readonly plantBottom = -16 + (G.soilH - G.plantBaseInSoil) * SCALE;
  protected readonly sceneH = this.plantBottom + this.plantW + 12;
  protected readonly sparkles = [
    { x: 28, y: 18, d: 0 },
    { x: 68, y: 26, d: 700 },
    { x: 40, y: 8, d: 1300 },
    { x: 62, y: 52, d: 1900 },
    { x: 30, y: 46, d: 2300 },
  ];

  protected readonly plant = computed(() => closeupPlantArt(this.info().object.itemType, this.info().stage));
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

  protected reached(stage: PlantStage): boolean {
    const order = STAGES.map((s) => s.id);
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
