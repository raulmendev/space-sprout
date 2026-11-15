import { Component, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { seeds } from '../../shared/format';
import { plantStages, type CareAction, type CareCheck, type CareEvent, type PlantStage } from '@garden/shared';
import type { CloseupInfo } from '../garden.store';
import { CLOSEUP_GEOMETRY as G } from '../game/closeup-art';
import { PREVIEW_SOIL, closeupHasSoil, glowPreviewTextureKey, previewTextureKey } from '../game/asset-registry';
import { AssetService } from '../../shared/assets.service';

const SCALE = 4; // integer scale keeps placeholder pixels crisp (64px art → 256px)
const SOIL_OVERFLOW = 12;

/** Radial layout: one action in each corner around the plant (DOM order = reading order). */
const ACTIONS: { id: CareAction; label: string; icon: string; spot: 'tl' | 'tr' | 'bl' | 'br' }[] = [
  { id: 'WATER', label: 'Water', icon: '💧', spot: 'tl' },
  { id: 'PRUNE', label: 'Prune', icon: '✂️', spot: 'tr' },
  { id: 'FERTILIZE', label: 'Fertilize', icon: '✨', spot: 'bl' },
  { id: 'HARVEST', label: 'Harvest', icon: '🧺', spot: 'br' },
];
const PAST: Record<CareAction, string> = { WATER: 'Watered', FERTILIZE: 'Fertilized', PRUNE: 'Pruned', HARVEST: 'Harvested' };
const BLOCKED: Record<string, string> = {
  ALREADY_MATURE: 'Complete',
  TOO_YOUNG: 'Too young',
  NOT_MATURE: 'Not ready',
  NO_FERTILIZER: 'Get at store',
};

const STAGE_LABELS: Record<PlantStage, string> = { SEED: 'Seed', SPROUT: 'Sprout', GROWING: 'Growing', BUD: 'Bud', MATURE: 'Grown' };
const STAGE_EMOJI: Record<PlantStage, string> = { SEED: '🌰', SPROUT: '🌱', GROWING: '🌿', BUD: '🌷', MATURE: '🌼' };


/**
 * Close-up of one plant, game style: the plant centre stage with the four care actions
 * around it, and the description and history behind the ⓘ button. Same frame as the
 * station dialogs (shared `.panel`, pixel title). A native modal <dialog>: focus
 * containment, Esc and the backdrop come from the browser.
 */
@Component({
  selector: 'app-plant-closeup',
  template: `
    <dialog #dialog closedby="any" aria-labelledby="closeup-title" (close)="closed.emit()">
      <div class="panel flex flex-col gap-3 p-4 short:gap-2 short:p-3">
        <header class="flex items-start justify-between gap-2">
          <div>
            <!-- Initial focus lands on the title (like the station panels), not on a button. -->
            <h2 id="closeup-title" tabindex="-1" autofocus class="font-pixel text-2xl leading-tight outline-none">{{ info().item.name }}</h2>
            <p class="flex flex-wrap items-center gap-x-2 text-sm font-bold text-leaf-dark">
              <span><span class="mr-1" aria-hidden="true">{{ stageEmoji() }}</span>{{ headline() }}</span>
              @if (info().thriving) {
                <span class="rounded bg-sun/50 px-1.5 text-[11px] font-bold uppercase tracking-wide text-bark-dark">✨ Thriving</span>
              }
            </p>
          </div>
          <div class="flex shrink-0 gap-1.5">
            <button
              type="button"
              class="round-btn"
              [class.on]="showDetails()"
              aria-label="Plant details"
              aria-controls="closeup-details"
              [attr.aria-expanded]="showDetails()"
              (click)="showDetails.set(!showDetails())"
            >ⓘ</button>
            <button type="button" class="round-btn" aria-label="Close" (click)="dialog.close()">✕</button>
          </div>
        </header>

        <section class="stage" [class.thriving]="info().thriving" aria-label="Plant and care">
          <div class="halo" aria-hidden="true"></div>
          <div class="plant-spot" [style.height.px]="sceneH">
            @if (!ownSoil()) {
              <img [src]="soil" alt="" class="soil pixelated" [style.width.px]="soilW" [style.bottom.px]="-soilOverflow" />
            }
            <img
              #plantImg
              [src]="plant()"
              [alt]="info().item.name"
              class="plant"
              [class.pixelated]="!delivered()"
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

          <div class="actions" role="group" aria-label="Care">
            @for (a of actions; track a.id) {
              @let c = info().actions[a.id];
              @let confirm = confirming() && a.id === 'HARVEST';
              <button
                type="button"
                class="action"
                [class]="'action ' + a.spot"
                [class.confirm]="confirm"
                [class.nudge]="a.id === 'WATER' && info().thirsty"
                [disabled]="!c.ok"
                [attr.aria-label]="(confirm ? 'Confirm harvest' : a.label) + ', ' + hint(a.id, c)"
                (click)="act(a.id)"
              >
                <span class="disc"><span aria-hidden="true">{{ a.icon }}</span></span>
                <span class="label">{{ confirm ? 'Sure?' : a.label }}</span>
                <span class="hint" [class.good]="c.ok && !confirm">{{ confirm ? 'Tap again' : hint(a.id, c) }}</span>
              </button>
            }
          </div>
        </section>

        @if (confirming()) {
          <p class="rounded-md bg-parchment/70 p-2 text-center text-xs">🧺 Harvesting frees the plot for something new.</p>
        }

        <p class="text-center text-sm" [class]="info().thirsty ? 'font-bold text-sky-700' : 'text-bark'" role="status">
          💧 {{ info().thirsty ? 'Thirsty. A drink would help.' : 'Last watered ' + ago(info().object.care?.lastWateredAt) }}
        </p>

        @if (showDetails()) {
          <section id="closeup-details" class="flex flex-col gap-2 rounded-lg border-2 border-bark/15 p-3 text-sm" aria-label="Details">
            <p class="text-bark">{{ info().item.description }}</p>
            <div>
              <p class="font-bold">
                {{ stageName() }} · stage {{ stageIndex() + 1 }} of {{ stageCount() }}
                @if (info().msToMature > 0) { <span class="font-normal text-bark/70">· fully grown in {{ countdown() }}</span> }
              </p>
              @if (info().msToMature > 0) {
                <div class="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-bark-dark bg-parchment" role="progressbar" aria-label="Growth" [attr.aria-valuenow]="progressPct()" aria-valuemin="0" aria-valuemax="100">
                  <div class="h-full bg-leaf transition-[width] duration-1000 ease-linear" [style.width.%]="progressPct()"></div>
                </div>
              }
            </div>
            @if (info().capReached) {
              <p class="rounded-md bg-parchment/70 p-2 text-xs">🌱 You've collected today's garden seeds. Care still helps it grow.</p>
            }
            <div>
              <h3 class="font-bold">Care history</h3>
              <ul class="mt-1 flex flex-col gap-1">
                <li class="flex justify-between gap-2">
                  <span>Planted by {{ who(info().object.placedBy, info().object.placedByName) }}</span>
                  <span class="shrink-0 text-xs text-bark/70">{{ planted() }}</span>
                </li>
                @for (e of recent(); track e.at + e.action) {
                  <li class="flex justify-between gap-2">
                    <span>{{ past(e) }} by {{ who(e.by, e.byName) }}</span>
                    <span class="shrink-0 text-xs text-bark/70">{{ ago(e.at) }}</span>
                  </li>
                }
              </ul>
            </div>
          </section>
        }
      </div>
    </dialog>
  `,
  styles: `
    /* Same frame as the station dialogs: a transparent <dialog> around the shared .panel. */
    dialog {
      margin: auto; /* Tailwind's reset zeroes margins, which removes the browser's own centring of modals */
      padding: 0;
      border: 0;
      background: transparent;
      width: min(40rem, 100vw - 2rem);
      max-width: none;
      max-height: calc(100dvh - 2rem);
      overflow: auto;
      container-type: inline-size;
    }
    dialog:modal { overscroll-behavior: contain; }
    dialog[open] .panel { animation: zoom 220ms cubic-bezier(.2, 1.3, .4, 1); }
    dialog::backdrop {
      background: rgb(29 27 58 / 0.55);
      overflow: hidden;
      overscroll-behavior: contain;
    }
    @keyframes zoom { from { opacity: 0; scale: .85; } }

    .round-btn {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      background: var(--color-parchment);
      font-size: 1.05rem;
      font-weight: 700;
    }
    .round-btn:hover, .round-btn.on { background: #ead2a8; }
    .round-btn:focus-visible { outline: 2px solid var(--color-sun); outline-offset: 2px; }

    /* ---- the stage: plant in a halo, actions in the corners ---- */
    .stage {
      position: relative;
      display: grid;
      place-items: center;
      padding: 16px 8px 8px;
      overflow: hidden;
      border-radius: 14px;
      background: #d4e8dc;
    }
    .halo {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 300px;
      height: 300px;
      translate: -50% -54%;
      border-radius: 999px;
      background: radial-gradient(circle, #c5e3bf 0 54%, rgb(197 227 191 / .45) 55% 100%);
      transition: background 400ms;
    }
    .stage.thriving .halo { background: radial-gradient(circle, #f3e7a6 0 54%, rgb(246 220 120 / .35) 55% 100%); }
    .plant-spot { position: relative; width: 256px; }
    .soil { position: absolute; left: 50%; translate: -50% 0; }
    .plant {
      position: absolute;
      left: 50%;
      transform-origin: 50% 100%;
      translate: -50% 0;
      animation: sway 4.5s ease-in-out infinite;
    }
    /* Art with its own soil mound: rocking it would rock the ground too. */
    .plant.still { animation: none; }
    @keyframes sway { 0%, 100% { rotate: -1.2deg; } 50% { rotate: 1.2deg; } }

    /* Narrow: actions in a row under the plant. Wide: one in each corner. */
    .actions { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; width: 100%; margin-top: 8px; }
    @container (min-width: 520px) {
      .stage { min-height: 360px; padding: 20px 0; }
      .actions { position: absolute; inset: 0; display: block; margin: 0; pointer-events: none; }
      .action { position: absolute; width: 104px; pointer-events: auto; }
      .tl { top: 18px; left: 18px; }
      .tr { top: 18px; right: 18px; }
      .bl { bottom: 14px; left: 18px; }
      .br { bottom: 14px; right: 18px; }
    }

    .action { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .disc {
      display: grid;
      place-items: center;
      width: 68px;
      height: 68px;
      border: 4px solid var(--color-bark);
      border-radius: 999px;
      background: #f6e6c6;
      font-size: 1.9rem;
      box-shadow: 0 3px 0 rgb(74 50 34 / .25);
      transition: translate 120ms, background 120ms;
    }
    .action:enabled:hover .disc { translate: 0 -3px; background: #fbefd6; }
    .action:enabled:active .disc { translate: 0 1px; box-shadow: none; }
    .action:focus-visible { outline: none; }
    .action:focus-visible .disc { outline: 3px solid var(--color-sun); outline-offset: 2px; }
    .action:disabled .disc { border-color: #b9a58f; filter: grayscale(.85); opacity: .7; box-shadow: none; }
    .action.confirm .disc { border-color: var(--color-bark-dark); background: var(--color-sun); }
    .action.nudge .disc { animation: nudge 1.6s ease-in-out infinite; }
    @keyframes nudge { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }
    .label { margin-top: 4px; font-weight: 700; font-size: .9rem; }
    .action:disabled .label { color: rgb(107 74 50 / .6); }
    .hint { font-size: .78rem; color: rgb(107 74 50 / .7); }
    .hint.good { color: var(--color-leaf-dark); font-weight: 600; }

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

    /* Short screens (landscape phones): fit the whole close-up without scrolling.
       Last in the sheet so it overrides the wide layout's sizes above. */
    @media (max-height: 500px) {
      .stage { min-height: 0; padding: 6px 0; }
      .plant-spot { zoom: .7; }
      .halo { width: 210px; height: 210px; }
      .disc { width: 48px; height: 48px; border-width: 3px; font-size: 1.35rem; }
      .label { margin-top: 2px; font-size: .8rem; }
      .hint { font-size: .7rem; }
      .tl, .tr { top: 8px; }
      .bl, .br { bottom: 6px; }
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
  /** Description, growth and history stay tucked away until the ⓘ button asks for them. */
  protected readonly showDetails = signal(false);
  private fxTimer?: ReturnType<typeof setTimeout>;
  private confirmTimer?: ReturnType<typeof setTimeout>;

  private readonly assets = inject(AssetService);
  protected readonly soil = this.assets.url(PREVIEW_SOIL);
  protected readonly soilOverflow = SOIL_OVERFLOW;
  protected readonly soilW = G.soilW * SCALE;
  protected readonly plantW = G.plantPx * SCALE;
  /** Soil overflows the bottom; plant base sits `plantBaseInSoil` px into the mound. */
  protected readonly plantBottom = -SOIL_OVERFLOW + (G.soilH - G.plantBaseInSoil) * SCALE;
  protected readonly sceneH = this.plantBottom + this.plantW;
  protected readonly sparkles = [
    { x: 28, y: 18, d: 0 },
    { x: 68, y: 26, d: 700 },
    { x: 40, y: 8, d: 1300 },
    { x: 62, y: 52, d: 1900 },
    { x: 30, y: 46, d: 2300 },
  ];

  private readonly plantKey = computed(() => {
    const { object, stage, thriving } = this.info();
    const glow = glowPreviewTextureKey(object.itemType, stage);
    return thriving && this.assets.has(glow) ? glow : previewTextureKey(object.itemType, stage);
  });
  protected readonly plant = computed(() => this.assets.url(this.plantKey()));
  /** Design-team art (smooth edges): don't force nearest-neighbour scaling on it. */
  protected readonly delivered = computed(() => this.assets.has(this.plantKey()));
  /** Delivered art that already stands in its own soil. */
  protected readonly ownSoil = computed(() => {
    const { object, stage } = this.info();
    return closeupHasSoil(object.itemType) && this.assets.has(previewTextureKey(object.itemType, stage));
  });

  private readonly stageIds = computed(() => plantStages(this.info().item));
  protected readonly stageCount = computed(() => this.stageIds().length);
  protected readonly stageIndex = computed(() => this.stageIds().indexOf(this.info().stage));
  protected readonly stageEmoji = computed(() => STAGE_EMOJI[this.info().stage]);
  protected readonly stageName = computed(() => this.info().item.stageLabels?.[this.info().stage] ?? STAGE_LABELS[this.info().stage]);
  /** "Blooming · Fully grown", "Seed · grown in 1m 20s"; plain "Fully grown" when the stage is just "Grown". */
  protected readonly headline = computed(() => {
    if (this.info().msToMature > 0) return `${this.stageName()} · grown in ${this.countdown()}`;
    return this.stageName() === STAGE_LABELS.MATURE ? 'Fully grown' : `${this.stageName()} · Fully grown`;
  });
  protected readonly progressPct = computed(() => Math.round(this.info().progress * 100));

  private readonly dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly plantImg = viewChild.required<ElementRef<HTMLImageElement>>('plantImg');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialogEl().nativeElement;
      dialog.showModal();
      lightDismissFallback(dialog);
    });
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

  /** Small line under each action: payout, cost, wait, or why it's unavailable. */
  protected hint(action: CareAction, c: CareCheck): string {
    if (c.error === 'COOLDOWN') return 'In ' + this.duration(c.readyInMs ?? 0);
    if (c.error) return BLOCKED[c.error] ?? 'Unavailable';
    if (c.uses) return `${this.info().fertilizer} left`;
    if (c.reward) return `+${seeds(c.reward)}`;
    return 'Ready';
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
    return s < 60 ? 'just now' : this.duration(s * 1000, Math.floor) + ' ago';
  }

  /** Waits round up ("in 4h" until it's really ready); "ago" rounds down so it matches "planted". */
  private duration(ms: number, round: (n: number) => number = Math.ceil): string {
    const m = round(ms / 60_000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  }

  protected readonly countdown = computed(() => {
    const s = Math.ceil(this.info().msToMature / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  });

  protected readonly planted = computed(() => {
    const s = Math.floor(this.info().ageMs / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    const days = Math.floor(s / 86400);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  });
}

/**
 * `closedby="any"` closes the modal on a backdrop click where supported (not Safari yet).
 * Elsewhere, close on a press and release that both land outside the dialog box.
 */
function lightDismissFallback(dialog: HTMLDialogElement): void {
  if ('closedBy' in HTMLDialogElement.prototype) return;
  const outside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => (pressedOutside = outside(e)));
  dialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && outside(e)) dialog.close();
  });
}
