import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ALL_METRICS, HealthMetric, METRICS, choicesFor, dayOf, validateMeasurement } from '@garden/shared';
import { HealthStore } from './health.store';
import { METRIC_ICON, MOODS, SOURCE_LABEL, SOURCE_SHORT, formatValue, timeAgo } from './format';

/**
 * Measurement collection: simulated wearable sync, or manual entry of any subset.
 * Drawn as the cream "screen" inside the station's steel console frame.
 */
@Component({
  selector: 'app-medical-terminal-panel',
  imports: [NgTemplateOutlet],
  template: `
    <div role="tablist" aria-label="How to add readings" class="grid grid-cols-2 gap-2">
      <button type="button" role="tab" class="console-tab btn-press" [attr.aria-selected]="tab() === 'sync'" (click)="tab.set('sync')">
        <span aria-hidden="true">⌚</span>Wearable sync
      </button>
      <button type="button" role="tab" class="console-tab btn-press" [attr.aria-selected]="tab() === 'manual'" (click)="tab.set('manual')">
        <span aria-hidden="true">✏️</span>Enter manually
      </button>
    </div>

    @if (tab() === 'sync') {
      <div class="grid flex-1 gap-3 short:gap-2 @lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div class="card riveted-card flex flex-col gap-2.5 short:gap-2">
          <div class="flex gap-3">
            <!-- The (simulated) wearable, drawn in the illustrated style: thick outline, soft shading. -->
            <div class="watch-tile" aria-hidden="true">
              <svg viewBox="0 0 80 100" class="h-full w-full">
                <path class="ink" d="M26 4h28l3 22H23z" fill="#4a4f6e" stroke-width="3" stroke-linejoin="round" />
                <path class="ink" d="M23 74h34l-3 22H26z" fill="#4a4f6e" stroke-width="3" stroke-linejoin="round" />
                <path d="M30 8v14M40 8v14M50 8v14M30 78v14M40 78v14M50 78v14" stroke="#3a3f5c" stroke-width="2" />
                <rect class="ink" x="14" y="22" width="52" height="56" rx="12" fill="#9aa2c4" stroke-width="3" />
                <rect class="ink" x="66" y="40" width="5" height="12" rx="2" fill="#9aa2c4" stroke-width="2.5" />
                <rect class="ink" x="20" y="28" width="40" height="44" rx="8" fill="#1d2b45" stroke-width="2" />
                <path d="M23 50h8l3-7 5 15 4-12 3 4h11" fill="none" stroke="#6fe0e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                  [class.pulse]="health.syncing()" />
                <path d="M24 31h12" stroke="#ffffff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round" />
              </svg>
              <span class="spark left-1.5 top-2">✦</span>
              <span class="spark bottom-3 right-1.5 text-[9px]">✦</span>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p class="font-bold leading-tight short:truncate short:text-[13px]">{{ health.wearable.label }}</p>
              <p><span class="rounded-md bg-dusk/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-dusk">Demo data</span></p>
              <p class="flex items-center gap-1.5 text-sm font-bold text-leaf-dark">
                <span class="size-2.5 rounded-full border border-leaf-dark bg-leaf" [class.animate-pulse]="health.syncing()"></span>
                {{ health.syncing() ? 'Syncing…' : 'Connected' }}
              </p>
              <p class="border-t border-bark/15 pt-1 text-xs text-bark/70">
                @if (health.lastSyncAt(); as at) { Last synced {{ ago(at) }} } @else { Not synced yet }
              </p>
            </div>
          </div>
          <button type="button" class="chunky-btn btn-press" [disabled]="health.syncing()" (click)="health.syncWearable()">
            <svg viewBox="0 0 24 24" class="size-5" [class.animate-spin]="health.syncing()" aria-hidden="true">
              <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
              <path d="M19.5 3v4.5H15M4.5 21v-4.5H9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ health.syncing() ? 'Syncing…' : 'Sync now' }}
          </button>
          <ng-container [ngTemplateOutlet]="reward" />
          <ng-container [ngTemplateOutlet]="privacy" />
        </div>

        <section class="card riveted-card flex flex-col gap-2 short:gap-1" aria-labelledby="today-title">
          <h3 id="today-title" class="flex items-center gap-2 font-bold short:text-sm">
            <span aria-hidden="true">📅</span>Today's check-in
            <span class="stripes ml-auto h-3 w-10" aria-hidden="true"></span>
          </h3>
          <ul class="flex flex-col gap-1 text-sm short:gap-0.5">
            @for (metric of order; track metric) {
              @let reading = health.today()[metric];
              <!-- On short screens a missing mood is just the faces below (no room for both). -->
              <li class="row" [attr.data-mood-pending]="metric === 'MOOD' && !reading ? '' : null">
                <span class="row-icon" aria-hidden="true">{{ icon[metric] }}</span>
                <span class="flex-1 font-semibold">{{ label(metric) }}</span>
                @if (reading) {
                  <span class="whitespace-nowrap font-bold text-leaf-dark">✓ {{ value(reading) }}</span>
                  <span class="w-10 text-[10px] text-bark/60" [title]="source[reading.source]">{{ sourceShort[reading.source] }}</span>
                } @else if (health.answeredToday()[metric]) {
                  <!-- Told a crew member "I don't know": answered, but nothing measured. -->
                  <span class="whitespace-nowrap font-bold text-bark/70">? Don't know</span>
                  @if (syncedToday() || !health.wearableMetrics.includes(metric)) {
                    <button type="button" class="text-xs font-bold underline" (click)="tab.set('manual')">Enter it</button>
                  }
                } @else {
                  @if (metric !== 'MOOD' && (syncedToday() || !health.wearableMetrics.includes(metric))) {
                    <button type="button" class="text-xs font-bold underline" (click)="tab.set('manual')">Enter it</button>
                  }
                  <span class="rounded-md bg-sun/60 px-1.5 text-xs font-extrabold">Missing</span>
                }
              </li>
            }
          </ul>
          @if (!health.today()['MOOD']) {
            <div class="rounded-lg bg-parchment/40 p-1.5 short:py-1">
              <p class="px-1 text-xs text-bark/80 short:hidden">The wearable can't read mood. How are you feeling?</p>
              <ng-container [ngTemplateOutlet]="moodPicker" [ngTemplateOutletContext]="{ $implicit: true }" />
            </div>
          } @else if (allDone()) {
            <p class="text-sm font-bold text-leaf-dark">All done for today 🌱</p>
          }
        </section>
      </div>
    } @else {
      <form class="grid flex-1 gap-3 short:gap-2 @lg:grid-cols-2" (submit)="$event.preventDefault(); save()">
        <div class="card riveted-card flex flex-col gap-1.5">
          @for (m of numberMetrics; track m.id) {
            <label class="row">
              <span class="row-icon" aria-hidden="true">{{ icon[m.id] }}</span>
              <span class="flex-1 whitespace-nowrap text-sm font-semibold">{{ m.label }}</span>
              <input
                type="number"
                inputmode="decimal"
                class="w-20 min-w-0 rounded-md border-2 border-bark/30 bg-cream px-2 py-1 text-right focus-visible:outline-2 focus-visible:outline-sun short:w-16 short:py-0"
                [min]="m.min" [max]="m.max" [step]="m.step"
                [value]="draft()[m.id] ?? ''"
                (input)="setDraft(m.id, $any($event.target).value)"
                [attr.aria-invalid]="!!errors()[m.id]"
                [attr.aria-describedby]="'err-' + m.id"
              />
              <span class="w-7 text-xs text-bark/70">{{ m.unit }}</span>
            </label>
            @if (errors()[m.id]; as e) { <p [id]="'err-' + m.id" class="-mt-1 text-right text-xs font-bold text-alert">{{ e }}</p> }
          }
          <p class="text-xs text-bark/70 short:hidden">Fill in any of these; you don't need all of them.</p>
        </div>
        <div class="card riveted-card flex flex-col gap-2">
          <fieldset>
            <legend class="flex items-center gap-2 font-bold"><span aria-hidden="true">{{ icon['MOOD'] }}</span>Mood</legend>
            <ng-container [ngTemplateOutlet]="moodPicker" [ngTemplateOutletContext]="{ $implicit: false }" />
          </fieldset>
          <!-- Other scales (stress): a word per step, tapped to toggle like the mood faces. -->
          @for (c of choiceMetrics; track c.metric) {
            <fieldset>
              <legend class="flex items-center gap-2 font-bold"><span aria-hidden="true">{{ icon[c.metric] }}</span>{{ label(c.metric) }}</legend>
              <div class="mt-1 grid grid-cols-5 gap-1">
                @for (o of c.options; track o.id) {
                  <button
                    type="button"
                    class="mood btn-press"
                    [attr.aria-pressed]="draft()[c.metric] === '' + o.value"
                    (click)="toggleChoice(c.metric, o.value!)"
                  ><span class="text-2xl leading-none short:text-lg" aria-hidden="true">{{ o.icon }}</span><span class="word">{{ o.label }}</span></button>
                }
              </div>
            </fieldset>
          }
          <button type="submit" class="chunky-btn btn-press" [disabled]="!canSave()">Save check-in</button>
          <ng-container [ngTemplateOutlet]="reward" />
          <ng-container [ngTemplateOutlet]="privacy" />
        </div>
      </form>
    }

    <!-- Mood faces. Quick: one tap saves the mood. Otherwise: toggles the mood in the manual draft. -->
    <ng-template #moodPicker let-quick>
      <div class="mt-1 grid grid-cols-5 gap-1" [class.quick]="quick" [attr.role]="quick ? 'group' : null" [attr.aria-label]="quick ? 'Quick mood check-in' : null">
        @for (mood of moods; track mood.value) {
          <button
            type="button"
            class="mood btn-press"
            [attr.aria-label]="quick ? 'Mood: ' + mood.label : null"
            [attr.aria-pressed]="quick ? null : draft()['MOOD'] === '' + mood.value"
            (click)="quick ? quickMood(mood.value) : toggleMood(mood.value)"
          ><span class="text-2xl leading-none short:text-lg" aria-hidden="true">{{ mood.face }}</span><span class="word">{{ mood.label }}</span></button>
        }
      </div>
    </ng-template>

    <!-- Inside a card's spare space, so it costs no height on short screens. -->
    <ng-template #privacy>
      <p class="mt-auto text-[11px] leading-tight text-bark/70">🔒 Only you can see your health data.</p>
    </ng-template>

    <!-- The checklist already shows the values; the result is just the seeds. -->
    <ng-template #reward>
      @if (health.lastResult(); as r) {
        <p class="reward" role="status">
          <span class="text-xl short:text-base" aria-hidden="true">🌱</span>
          @if (r.earned > 0) { <span>+{{ r.earned }} seeds<span class="short:hidden"> for checking in</span>@if (!r.bonuses.length) {<span class="hidden short:inline"> earned</span>}</span> }
          @else if (r.alreadyRewarded) { <span class="short:hidden">Saved. Today's seeds for these are already yours</span><span class="hidden short:inline">{{ r.bonuses.length ? 'Saved' : 'Saved. Already earned today' }}</span> }
          @else { Saved. }
          @for (b of r.bonuses; track b.ref) {
            <span class="bonus short:hidden" [title]="b.label + ': +' + b.amount + ' seeds'">{{ b.reason === 'GOAL' ? '🎯' : '🔥' }} {{ b.label }} +{{ b.amount }}</span>
          }
          <!-- Phones: the bonuses as one total, so the banner stays on one line. -->
          @if (r.bonuses.length) { <span class="bonus hidden short:inline" [title]="bonusList(r.bonuses)">+{{ bonusTotal(r.bonuses) }} bonus</span> }
        </p>
      } @else {
        <p class="reward muted"><span class="text-xl short:text-base" aria-hidden="true">🌱</span>Check in to earn seeds</p>
      }
    </ng-template>
  `,
  host: { class: 'console-screen flex min-h-0 flex-1 flex-col gap-3 short:gap-2' },
  styles: `
    /* Screen, tabs and riveted cards come from the shared console classes in styles.css. */
    :host { --stripe: color-mix(in srgb, var(--color-steel) 25%, transparent); } /* the bezel's cream stripes would vanish on the screen */
    .card { padding: 12px; }

    /* Illustration colours for the watch art; the outline uses the console ink. */
    .watch-tile {
      position: relative;
      flex-shrink: 0;
      width: 6rem;
      height: 7rem;
      padding: 6px 10px;
      border: 2px solid #8fb2d9;
      border-radius: 10px;
      background: linear-gradient(160deg, #d6e8f8, #a9c8ec);
    }
    .ink { stroke: var(--color-steel-dark); }
    .spark { position: absolute; color: #fff; font-size: 12px; line-height: 1; }
    .pulse { animation: pulse 0.8s ease-in-out infinite alternate; }
    @keyframes pulse { to { stroke: #fff; } }


    .row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-right: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-bark) 12%, transparent);
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .row-icon {
      display: grid;
      place-items: center;
      align-self: stretch;
      width: 2rem;
      min-height: 1.9rem;
      background: color-mix(in srgb, var(--color-parchment) 60%, transparent);
      font-size: 1rem;
    }

    .mood {
      --press: color-mix(in srgb, var(--color-bark) 15%, transparent);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 0.35rem 0;
      background: #fff;
      font-size: 11px;
      font-weight: 700;
    }
    .mood:hover { background: color-mix(in srgb, var(--color-sun) 30%, transparent); }
    .mood[aria-pressed='true'] { --press: var(--color-bark-dark); background: color-mix(in srgb, var(--color-sun) 70%, transparent); }

    .reward {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      border: 2px solid var(--color-leaf);
      border-radius: 10px;
      background: color-mix(in srgb, var(--color-leaf) 12%, transparent);
      font-weight: 800;
      font-size: 0.9rem;
    }
    .reward { flex-wrap: wrap; }
    .bonus { white-space: nowrap; color: var(--color-leaf-dark); }
    .reward.muted {
      border-style: dashed;
      border-color: color-mix(in srgb, var(--color-leaf) 50%, transparent);
      font-weight: 700;
      color: color-mix(in srgb, var(--color-bark-dark) 70%, transparent);
    }

    /* Same breakpoint as the short: variant in styles.css: compact everything to fit landscape phones. */
    @media (max-height: 500px) {
      .card { padding: 6px 10px; }
      .watch-tile { width: 3.5rem; height: 4.5rem; padding: 3px 4px; }
      .chunky-btn { padding: 0.3rem 0.75rem; font-size: 1rem; }
      .row-icon { min-height: 1.2rem; }
      .row[data-mood-pending] { display: none; }
      .quick .word { display: none; } /* faces only; each button keeps its "Mood: …" label */
      .mood { padding: 0.1rem 0; font-size: 10px; }
      /* One line on phones, whatever the result says (screen readers still get all of it). */
      .reward { flex-wrap: nowrap; overflow: hidden; white-space: nowrap; padding: 0.2rem 0.5rem; font-size: 0.8rem; }
    }
  `,
})
export class MedicalTerminalPanelComponent {
  protected readonly health = inject(HealthStore);
  protected bonusTotal = (bonuses: readonly { amount: number }[]) => bonuses.reduce((sum, b) => sum + b.amount, 0);
  /** "Sleep goal +2, 3-day streak +3". */
  protected bonusList = (bonuses: readonly { label: string; amount: number }[]) => bonuses.map((b) => `${b.label} +${b.amount}`).join(', ');
  protected readonly tab = signal<'sync' | 'manual'>('sync');
  protected readonly moods = MOODS;
  protected readonly icon = METRIC_ICON;
  protected readonly source = SOURCE_LABEL;
  protected readonly sourceShort = SOURCE_SHORT;
  /** Every reading, the crew's included: what you put off with them can be finished here. */
  protected readonly order = ALL_METRICS;
  /** Only offer "Enter it" for wearable metrics once today's sync has run (before that, Sync is the action). */
  protected readonly syncedToday = computed(() => {
    const at = this.health.lastSyncAt();
    return !!at && dayOf(at) === dayOf(new Date().toISOString());
  });
  protected readonly allDone = computed(() => ALL_METRICS.every((m) => this.health.answeredToday()[m]));
  protected readonly numberMetrics = ALL_METRICS.filter((m) => METRICS[m].input === 'number').map((m) => METRICS[m]);
  /** Scale readings other than mood (which has its faces). */
  protected readonly choiceMetrics = ALL_METRICS.filter((m) => m !== 'MOOD' && choicesFor(m).length).map((metric) => ({
    metric,
    options: choicesFor(metric),
  }));
  protected readonly draft = signal<Partial<Record<HealthMetric, string>>>({});

  protected readonly errors = computed(() => {
    const out: Partial<Record<HealthMetric, string>> = {};
    for (const [metric, raw] of Object.entries(this.draft()) as [HealthMetric, string][]) {
      if (raw === '' || raw === undefined) continue;
      const e = validateMeasurement(metric, Number(raw));
      if (e) out[metric] = e;
    }
    return out;
  });

  protected readonly canSave = computed(
    () => Object.values(this.draft()).some((v) => v !== '' && v !== undefined) && !Object.keys(this.errors()).length,
  );

  protected setDraft(metric: HealthMetric, raw: string): void {
    this.draft.update((d) => ({ ...d, [metric]: raw }));
  }

  protected toggleMood(value: number): void {
    this.toggleChoice('MOOD', value);
  }

  protected toggleChoice(metric: HealthMetric, value: number): void {
    this.setDraft(metric, this.draft()[metric] === String(value) ? '' : String(value));
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const values: Partial<Record<HealthMetric, number>> = {};
    for (const [metric, raw] of Object.entries(this.draft()) as [HealthMetric, string][]) if (raw !== '') values[metric] = Number(raw);
    await this.health.submitManual(values);
    this.draft.set({});
  }

  /** One-tap mood from the checklist, since the wearable can't provide it. */
  protected quickMood(value: number): Promise<number> {
    return this.health.submitManual({ MOOD: value });
  }

  protected label = (m: HealthMetric) => METRICS[m].label;
  protected value = formatValue;
  protected ago = (iso: string) => timeAgo(iso);
}
