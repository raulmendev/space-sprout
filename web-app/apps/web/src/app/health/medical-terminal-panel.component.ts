import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HealthMetric, METRICS, METRIC_ORDER, dayOf, validateMeasurement } from '@garden/shared';
import { HealthStore } from './health.store';
import { MOODS, SOURCE_LABEL, SOURCE_SHORT, formatValue, timeAgo } from './format';

/** Measurement collection: simulated wearable sync, or manual entry of any subset. */
@Component({
  selector: 'app-medical-terminal-panel',
  imports: [NgTemplateOutlet],
  template: `
    <div role="tablist" aria-label="How to add readings" class="flex gap-1 rounded-lg bg-parchment p-1 text-sm font-bold">
      <button type="button" role="tab" class="flex-1 rounded-md px-2 py-1" [class.bg-cream]="tab() === 'sync'" [attr.aria-selected]="tab() === 'sync'" (click)="tab.set('sync')">Wearable sync</button>
      <button type="button" role="tab" class="flex-1 rounded-md px-2 py-1" [class.bg-cream]="tab() === 'manual'" [attr.aria-selected]="tab() === 'manual'" (click)="tab.set('manual')">Enter manually</button>
    </div>

    @if (tab() === 'sync') {
      <div class="grid gap-3 short:gap-2 @lg:grid-cols-2">
        <div class="flex flex-col gap-2 rounded-lg bg-parchment/70 p-3 short:p-2.5">
          <p class="flex flex-wrap items-center gap-2 text-sm">
            <span aria-hidden="true">⌚</span><b>{{ health.wearable.label }}</b>
            <span class="rounded bg-night/10 px-1.5 text-[11px] font-bold uppercase tracking-wide">Demo data</span>
          </p>
          <p class="text-xs text-bark/70">
            @if (health.lastSyncAt(); as at) { Last synced {{ ago(at) }} } @else { Not synced yet }
          </p>
          <button
            type="button"
            class="w-full rounded-lg border-2 border-bark-dark bg-sun px-3 py-2 font-bold enabled:hover:brightness-105 disabled:opacity-60 short:py-1.5"
            [disabled]="health.syncing()"
            (click)="health.syncWearable()"
          >{{ health.syncing() ? 'Syncing…' : 'Sync now' }}</button>
          <ng-container [ngTemplateOutlet]="reward" />
        </div>

        <section class="rounded-lg border-2 border-bark/15 p-3 short:p-2.5" aria-labelledby="today-title">
          <h3 id="today-title" class="text-sm font-bold">Today's check-in</h3>
          <ul class="mt-1 flex flex-col gap-1 text-sm">
            @for (metric of order; track metric) {
              @let reading = health.today()[metric];
              <li>
                <div class="flex items-center justify-between gap-2">
                  <span>{{ label(metric) }}</span>
                  @if (reading) {
                    <span class="font-bold text-leaf-dark">✓ {{ value(reading) }}<span class="ml-1 text-[10px] font-normal text-bark/60" [title]="source[reading.source]">{{ sourceShort[reading.source] }}</span></span>
                  } @else {
                    <span class="rounded bg-sun/50 px-1.5 text-xs font-bold">Missing</span>
                  }
                </div>
                @if (!reading) {
                  @if (metric === 'MOOD') {
                    <p class="mt-0.5 text-xs text-bark/80">The wearable can't read mood. How are you feeling?</p>
                    <div class="mt-1 flex justify-between gap-1" role="group" aria-label="Quick mood check-in">
                      @for (mood of moods; track mood.value) {
                        <button
                          type="button"
                          class="flex flex-1 flex-col items-center rounded-md border-2 border-transparent bg-parchment/70 py-0.5 text-[10px] hover:border-bark/40 focus-visible:outline-2 focus-visible:outline-sun"
                          [attr.aria-label]="'Mood: ' + mood.label"
                          (click)="quickMood(mood.value)"
                        ><span class="text-lg leading-tight" aria-hidden="true">{{ mood.face }}</span>{{ mood.label }}</button>
                      }
                    </div>
                  } @else if (syncedToday()) {
                    <button type="button" class="text-xs font-bold underline" (click)="tab.set('manual')">Enter it manually</button>
                  }
                }
              </li>
            }
          </ul>
          @if (allDone()) {
            <p class="mt-1.5 text-sm font-bold text-leaf-dark">All done for today 🌱</p>
          }
        </section>
      </div>
    } @else {
      <form class="grid gap-3 short:gap-2 @lg:grid-cols-2" (submit)="$event.preventDefault(); save()">
        <div class="flex flex-col gap-2">
          @for (m of numberMetrics; track m.id) {
            <label class="flex items-center justify-between gap-2 text-sm">
              <span class="font-bold">{{ m.label }}</span>
              <span class="flex items-center gap-1">
                <input
                  type="number"
                  inputmode="decimal"
                  class="w-20 rounded-md border-2 border-bark/30 bg-cream px-2 py-1 text-right focus-visible:outline-2 focus-visible:outline-sun short:py-0.5"
                  [min]="m.min" [max]="m.max" [step]="m.step"
                  [value]="draft()[m.id] ?? ''"
                  (input)="setDraft(m.id, $any($event.target).value)"
                  [attr.aria-invalid]="!!errors()[m.id]"
                  [attr.aria-describedby]="'err-' + m.id"
                />
                <span class="w-7 text-xs text-bark/70">{{ m.unit }}</span>
              </span>
            </label>
            @if (errors()[m.id]; as e) { <p [id]="'err-' + m.id" class="-mt-1 text-right text-xs font-bold text-[#a33]">{{ e }}</p> }
          }
          <p class="text-xs text-bark/70">Fill in any of these; you don't need all of them.</p>
        </div>
        <div class="flex flex-col gap-2">
          <fieldset class="text-sm">
            <legend class="font-bold">Mood</legend>
            <div class="mt-1 flex justify-between gap-1">
              @for (mood of moods; track mood.value) {
                <button
                  type="button"
                  class="flex flex-1 flex-col items-center rounded-md border-2 py-1 text-[11px] short:py-0.5"
                  [class]="draft()['MOOD'] === '' + mood.value ? 'border-bark-dark bg-sun/60' : 'border-transparent bg-parchment/70'"
                  [attr.aria-pressed]="draft()['MOOD'] === '' + mood.value"
                  (click)="setDraft('MOOD', draft()['MOOD'] === '' + mood.value ? '' : '' + mood.value)"
                ><span class="text-xl leading-tight" aria-hidden="true">{{ mood.face }}</span>{{ mood.label }}</button>
              }
            </div>
          </fieldset>
          <button type="submit" class="rounded-lg border-2 border-bark-dark bg-sun px-3 py-2 font-bold disabled:opacity-50 short:py-1.5" [disabled]="!canSave()">Save check-in</button>
          <ng-container [ngTemplateOutlet]="reward" />
        </div>
      </form>
    }

    <!-- The checklist already shows the values; the result is just the seeds. -->
    <ng-template #reward>
      @if (health.lastResult(); as r) {
        <p class="rounded-md border-2 border-leaf/50 bg-leaf/10 px-2 py-1 text-sm font-bold" role="status">
          @if (r.earned > 0) { +{{ r.earned }} seeds for checking in 🌱 }
          @else if (r.alreadyRewarded) { Saved. Today's seeds for these are already yours 🌱 }
          @else { Saved. }
        </p>
      }
    </ng-template>
  `,
  host: { class: 'flex flex-col gap-3 short:gap-2' },
})
export class MedicalTerminalPanelComponent {
  protected readonly health = inject(HealthStore);
  protected readonly tab = signal<'sync' | 'manual'>('sync');
  protected readonly moods = MOODS;
  protected readonly source = SOURCE_LABEL;
  protected readonly sourceShort = SOURCE_SHORT;
  protected readonly order = METRIC_ORDER;
  /** Only offer "Enter it manually" for wearable metrics once today's sync has run (before that, Sync is the action). */
  protected readonly syncedToday = computed(() => {
    const at = this.health.lastSyncAt();
    return !!at && dayOf(at) === dayOf(new Date().toISOString());
  });
  protected readonly allDone = computed(() => METRIC_ORDER.every((m) => this.health.today()[m]));
  protected readonly numberMetrics = METRIC_ORDER.filter((m) => METRICS[m].input === 'number').map((m) => METRICS[m]);
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

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const values: Partial<Record<HealthMetric, number>> = {};
    for (const [metric, raw] of Object.entries(this.draft()) as [HealthMetric, string][]) if (raw !== '') values[metric] = Number(raw);
    await this.health.submitManual(values);
    this.draft.set({});
  }

  /** One-tap mood from the checklist, since the wearable can't provide it. */
  protected quickMood(value: number): Promise<void> {
    return this.health.submitManual({ MOOD: value });
  }

  protected label = (m: HealthMetric) => METRICS[m].label;
  protected value = formatValue;
  protected ago = (iso: string) => timeAgo(iso);
}
