import { Component, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { CARE_PAST } from '../care-labels';
import { t } from '../../i18n/i18n';
import { seeds, whoDid } from '../../shared/format';
import { LABEL_RULES, labelText, plantStages, type CareAction, type CareCheck, type CareEvent, type PlantStage } from '@garden/shared';
import type { CloseupInfo } from '../garden.store';
import { CLOSEUP_GEOMETRY as G } from '../game/closeup-art';
import { LABEL_PANEL, PLANT_LABEL_TEXTURE, PREVIEW_SOIL, closeupHasSoil, glowPreviewTextureKey, previewTextureKey } from '../game/asset-registry';
import { AssetService } from '../../shared/assets.service';

const SCALE = 4; // integer scale keeps placeholder pixels crisp (64px art → 256px)
const SOIL_OVERFLOW = 12;

/** Radial layout: one action in each corner around the plant (DOM order = reading order). */
const ACTIONS: { id: CareAction; label: string; icon: string; spot: 'tl' | 'tr' | 'bl' | 'br' }[] = [
  { id: 'WATER', label: 'Water|verb', icon: '💧', spot: 'tl' },
  { id: 'PRUNE', label: 'Prune', icon: '✂️', spot: 'tr' },
  { id: 'FERTILIZE', label: 'Fertilize', icon: '✨', spot: 'bl' },
  { id: 'HARVEST', label: 'Harvest', icon: '🧺', spot: 'br' },
];
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
      <div class="panel flex min-h-0 flex-1 flex-col gap-3 p-4 short:gap-2 short:p-3">
        <header class="flex shrink-0 items-start justify-between gap-2">
          <div>
            <!-- Initial focus lands on the title (like the station panels), not on a button. -->
            <h2 id="closeup-title" tabindex="-1" autofocus class="font-pixel text-2xl leading-tight outline-none short:text-xl">{{ t(info().item.name) }}</h2>
            <p class="flex flex-wrap items-center gap-x-2 text-sm font-bold text-leaf-dark">
              <span><span class="mr-1" aria-hidden="true">{{ stageEmoji() }}</span>{{ headline() }}</span>
              @if (info().thriving) {
                <span class="rounded bg-sun/50 px-1.5 text-[11px] font-bold uppercase tracking-wide text-bark-dark">{{ t('✨ Thriving') }}</span>
              }
            </p>
          </div>
          <div class="flex shrink-0 gap-1.5">
            <button
              type="button"
              class="round-btn"
              [class.on]="showDetails()"
              [attr.aria-label]="t('Plant details')"
              aria-controls="closeup-details"
              [attr.aria-expanded]="showDetails()"
              (click)="showDetails.set(!showDetails())"
            >ⓘ</button>
            <button type="button" class="round-btn" [attr.aria-label]="t('Close')" (click)="dialog.close()">✕</button>
          </div>
        </header>

        <!-- The popup has a fixed height: the header stays put and everything below scrolls. -->
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain short:gap-2">
        <section class="stage" [class.thriving]="info().thriving" [attr.aria-label]="t('Plant and care')">
          <div class="halo" aria-hidden="true"></div>
          <div class="plant-spot" [style.height.px]="sceneH">
            @if (!ownSoil()) {
              <img [src]="soil" alt="" class="soil pixelated" [style.width.px]="soilW" [style.bottom.px]="-soilOverflow" />
            }
            <img
              #plantImg
              [src]="plant()"
              [alt]="t(info().item.name)"
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

            <!--
              The plant's label stands in its soil, over the plant's foot, so it never makes the popup taller.
              Unnamed, a faded sign offers to name it (it uses a label from the inventory); tap a name to rename it.
            -->
            @let named = info().object.label;
            <div class="sign" [class.ghost]="!named && !editing()">
              <img [src]="signArt" alt="" class="sign-art" />
              <div class="sign-panel" [style.left.%]="panel.left * 100" [style.right.%]="(1 - panel.right) * 100" [style.top.%]="panel.top * 100" [style.bottom.%]="(1 - panel.bottom) * 100">
                @if (editing()) {
                  <input
                    #nameInput
                    class="sign-input"
                    [style.--chars]="draftChars()"
                    [value]="draft()"
                    [attr.maxlength]="maxLength"
                    [placeholder]="t('Birth of Johanna')"
                    [attr.aria-label]="t('Name on the label')"
                    enterkeyhint="done"
                    autocomplete="off"
                    (input)="draft.set(nameInput.value)"
                    (keydown.enter)="save()"
                    (keydown.escape)="cancel($event)"
                  />
                } @else {
                  <button type="button" class="sign-name" [style.--chars]="signChars()" [disabled]="!named && !info().labels" [attr.aria-label]="signLabel()" (click)="edit()">
                    {{ signText() }}
                  </button>
                }
              </div>
              @if (editing()) {
                <span class="sign-tools">
                  <button type="button" class="round-btn ok" [attr.aria-label]="clearing() ? t('Take the label off') : t('Save the name')" (click)="save()">{{ clearing() ? '🗑️' : '✓' }}</button>
                  <button type="button" class="round-btn" [attr.aria-label]="t('Cancel')" (click)="cancel()">✕</button>
                </span>
              }
            </div>
          </div>

          <div class="actions" role="group" [attr.aria-label]="t('Care')">
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
                [attr.aria-label]="(confirm ? t('Confirm harvest') : t(a.label)) + ', ' + hint(a.id, c)"
                (click)="act(a.id)"
              >
                <span class="disc"><span aria-hidden="true">{{ a.icon }}</span></span>
                <span class="label">{{ confirm ? t('Sure?') : t(a.label) }}</span>
                <span class="hint" [class.good]="c.ok && !confirm">{{ confirm ? t('Tap again') : hint(a.id, c) }}</span>
              </button>
            }
          </div>
        </section>

        @if (confirming()) {
          <p class="rounded-md bg-parchment/70 p-2 text-center text-xs">{{ t('🧺 Harvesting frees the plot for something new.') }}</p>
        }

        <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <p class="text-center text-sm" [class]="info().thirsty ? 'font-bold text-sky-700' : 'text-bark'" role="status">
            💧 {{ info().thirsty ? t('Thirsty. A drink would help.') : t('Last watered {when}', { when: ago(info().object.care?.lastWateredAt) }) }}
          </p>
          <!-- Grown plants can move indoors: potting takes it out of the plot and into the inventory. -->
          @if (info().stage === 'MATURE') {
            <!-- A round button like the care actions. Without a pot the hint stays readable and says where to get one. -->
            <button type="button" class="pot" [disabled]="!info().pots" aria-describedby="pot-hint" (click)="pot.emit()">
              <span class="disc"><span aria-hidden="true">🪴</span></span>
              <span class="flex flex-col items-start text-left">
                <span class="label">{{ t('Pot it') }}</span>
                <span id="pot-hint" class="text-xs font-semibold text-bark">{{ potHint() }}</span>
              </span>
            </button>
          }
        </div>

        @if (showDetails()) {
          <section id="closeup-details" class="flex flex-col gap-2 rounded-lg border-2 border-bark/15 p-3 text-sm" [attr.aria-label]="t('Details')">
            <p class="text-bark">{{ t(info().item.description) }}</p>
            <div>
              <p class="font-bold">
                {{ t('{stage} · stage {i} of {n}', { stage: stageName(), i: stageIndex() + 1, n: stageCount() }) }}
                @if (info().msToMature > 0) { <span class="font-normal text-bark/70">{{ t('· fully grown in {time}', { time: countdown() }) }}</span> }
              </p>
              @if (info().msToMature > 0) {
                <div class="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-bark-dark bg-parchment" role="progressbar" [attr.aria-label]="t('Growth')" [attr.aria-valuenow]="progressPct()" aria-valuemin="0" aria-valuemax="100">
                  <div class="h-full bg-leaf transition-[width] duration-1000 ease-linear" [style.width.%]="progressPct()"></div>
                </div>
              }
            </div>
            @if (info().capReached) {
              <p class="rounded-md bg-parchment/70 p-2 text-xs">{{ t("🌱 You've collected today's garden seeds. Care still helps it grow.") }}</p>
            }
            <div>
              <h3 class="font-bold">{{ t('Care history') }}</h3>
              <ul class="mt-1 flex flex-col gap-1">
                <li class="flex justify-between gap-2">
                  <span>{{ t('Planted by {who}', { who: who(info().object.placedBy, info().object.placedByName) }) }}</span>
                  <span class="shrink-0 text-xs text-bark/70">{{ planted() }}</span>
                </li>
                @for (e of recent(); track e.at + e.action) {
                  <li class="flex justify-between gap-2">
                    <span>{{ past(e) }}</span>
                    <span class="shrink-0 text-xs text-bark/70">{{ ago(e.at) }}</span>
                  </li>
                }
              </ul>
            </div>
          </section>
        }
        </div>
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
      /* Fixed height, like the station popups: it doesn't grow when ⓘ opens; the body scrolls. */
      height: min(34rem, 100dvh - 2rem);
      max-height: none; /* the height above already caps it; the browser's modal default is tighter */
      overflow: hidden;
      container-type: inline-size;
    }
    dialog:modal { display: flex; flex-direction: column; overscroll-behavior: contain; }
    .stage { flex-shrink: 0; }
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

    /* "Pot it": the care actions' disc, smaller, with its label beside it. */
    .pot { display: flex; align-items: center; gap: 8px; }
    .pot .disc { width: 48px; height: 48px; border-width: 3px; font-size: 1.4rem; background: var(--color-sun); }
    .pot .label { margin-top: 0; }
    .pot:enabled:hover .disc { translate: 0 -2px; }
    .pot:enabled:active .disc { translate: 0 1px; box-shadow: none; }
    .pot:focus-visible { outline: none; }
    .pot:focus-visible .disc { outline: 3px solid var(--color-sun); outline-offset: 2px; }
    .pot:disabled .disc { border-style: dashed; border-color: #b9a58f; background: #f6e6c6; filter: grayscale(.85); box-shadow: none; }
    .pot:disabled .label { color: rgb(107 74 50 / .6); }

    /* The label: the design team's sign standing in the plant's soil, the name centred on its cream panel. */
    .sign { position: absolute; z-index: 1; left: 50%; bottom: -6px; width: 168px; translate: -50% 0; }
    .sign.ghost { opacity: .6; transition: opacity 150ms; }
    .sign.ghost:hover, .sign.ghost:focus-within { opacity: 1; }
    .sign-art { display: block; width: 100%; }
    .sign-panel { position: absolute; display: grid; place-items: center; padding: 0 4px; container-type: inline-size; }
    .sign-tools { position: absolute; left: 100%; bottom: 30%; display: flex; gap: 4px; margin-left: 6px; }
    .round-btn.ok { background: var(--color-sun); }
    /* Pixelify Sans runs about 0.6em a character: the text fills the panel's width, between 8 and 18 px. */
    .sign-name, .sign-input {
      font-size: clamp(8px, 100cqw / (var(--chars) * 0.62), 18px);
      border-radius: 4px;
      width: 100%;
      font-family: var(--font-pixel);
      font-weight: 600;
      line-height: 1;
      color: #4a2c1c;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sign-name { cursor: text; }
    .sign-name:enabled:hover { background: rgb(255 255 255 / .25); }
    .sign-name:disabled { cursor: default; }
    .sign-name:focus-visible { outline: 2px solid var(--color-sun); outline-offset: 1px; }
    /* While typing, the text shrinks as it grows, like the name it becomes. */
    .sign-input { height: 100%; background: rgb(255 255 255 / .55); outline: 2px solid var(--color-sun); }
    .sign-input::placeholder { color: rgb(74 44 28 / .4); }

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
      .pot .disc { width: 40px; height: 40px; font-size: 1.15rem; }
      /* Inside the zoomed plant spot: a little wider so the name stays readable. */
      .sign { width: 200px; }
      .sign-tools { zoom: 1.3; }
      .tl, .tr { top: 8px; }
      .bl, .br { bottom: 6px; }
    }
  `,
})
export class PlantCloseupComponent {
  readonly info = input.required<CloseupInfo>();
  readonly closed = output<void>();
  readonly care = output<CareAction>();
  /** "Pot it": move this grown plant into a pot, in the inventory. */
  readonly pot = output<void>();
  /** The plant's new name (empty: take the label off). */
  readonly label = output<string>();

  protected readonly signArt = inject(AssetService).url(PLANT_LABEL_TEXTURE);
  protected readonly panel = LABEL_PANEL;
  protected readonly maxLength = LABEL_RULES.maxLength;
  /** Writing the plant's name on its label. */
  protected readonly editing = signal(false);
  protected readonly draft = signal('');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  /** What the sign says: the plant's name, or an offer to name it (and where labels come from). */
  protected readonly signText = computed(() => {
    const { object, labels } = this.info();
    return object.label ?? (labels ? t('🏷️ Name it') : t('🛒 Get a label'));
  });
  /** Its length, for sizing it to fill the panel. */
  protected readonly signChars = computed(() => [...this.signText()].length);
  protected readonly signLabel = computed(() => {
    const { object, labels } = this.info();
    if (object.label) return t('Label: {name}. Rename', { name: object.label });
    return labels ? t('Name this plant (uses a plant label, {n} left)', { n: labels }) : t('Name this plant: plant labels are sold at the Supply Store');
  });
  /** The draft's length for sizing it, never below a short name's so the first letters aren't huge. */
  protected readonly draftChars = computed(() => Math.max(10, [...this.draft()].length + 1));
  /** Saving an empty name on a named plant takes its label off. */
  protected readonly clearing = computed(() => !!this.info().object.label && !labelText(this.draft()));

  protected edit(): void {
    this.draft.set(this.info().object.label ?? '');
    this.editing.set(true);
  }

  protected save(): void {
    const text = labelText(this.draft());
    this.editing.set(false);
    if (text !== (this.info().object.label ?? '')) this.label.emit(text);
  }

  /** Esc stops writing but keeps the close-up open. */
  protected cancel(e?: Event): void {
    e?.preventDefault();
    e?.stopPropagation();
    this.editing.set(false);
  }

  protected readonly potHint = computed(() =>
    this.info().pots ? t('Uses a clay pot ({n} left)', { n: this.info().pots }) : t('🛒 Clay pots are sold at the Supply Store'),
  );

  protected readonly t = t;
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
  /** The stage's English name (compared against STAGE_LABELS); shown through `t()`. */
  private readonly stageEn = computed(() => this.info().item.stageLabels?.[this.info().stage] ?? STAGE_LABELS[this.info().stage]);
  protected readonly stageName = computed(() => t(this.stageEn()));
  /** "Blooming · Fully grown", "Seed · grown in 1m 20s"; plain "Fully grown" when the stage is just "Grown". */
  protected readonly headline = computed(() => {
    if (this.info().msToMature > 0) return t('{stage} · grown in {time}', { stage: this.stageName(), time: this.countdown() });
    return this.stageEn() === STAGE_LABELS.MATURE ? t('Fully grown') : t('{stage} · Fully grown', { stage: this.stageName() });
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
    // Writing a name: select what's there, ready to type over.
    effect(() => this.nameInput()?.nativeElement.select());
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
    if (c.error === 'COOLDOWN') return t('In {time}', { time: this.duration(c.readyInMs ?? 0) });
    if (c.error) return t(BLOCKED[c.error] ?? 'Unavailable');
    if (c.uses) return t('{n} left', { n: this.info().fertilizer });
    if (c.reward) return `+${seeds(c.reward)}`;
    return t('Ready');
  }

  protected readonly recent = computed(() => this.info().log.slice(0, 3));

  /** "Watered by you" (Spanish: "Riego: tú"). */
  protected past(e: CareEvent): string {
    return t(`${CARE_PAST[e.action]} by {who}`, { who: this.who(e.by, e.byName) });
  }

  protected who(id: string | undefined, name: string | undefined): string {
    return whoDid(id, name, this.info().me);
  }

  /** Relative time against the shared growth clock. */
  protected ago(iso: string | undefined): string {
    if (!iso) return t('never');
    const now = Date.parse(this.info().object.createdAt) + this.info().ageMs;
    const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
    return s < 60 ? t('just now') : t('{time} ago', { time: this.duration(s * 1000, Math.floor) });
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
    if (s < 60) return t('just now');
    if (s < 3600) return t('{n}m ago', { n: Math.floor(s / 60) });
    if (s < 86400) return t('{n}h ago', { n: Math.floor(s / 3600) });
    const days = Math.floor(s / 86400);
    return days === 1 ? t('yesterday') : t('{n} days ago', { n: days });
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
