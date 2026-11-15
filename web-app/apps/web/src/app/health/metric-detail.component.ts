import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { GOALS, HABIT_REWARD, HealthMetric, METRICS, clampGoal, dayOf, goalTarget, isGoalMetric } from '@garden/shared';
import { HealthStore } from './health.store';
import { TrendChartComponent } from './trend-chart.component';
import { METRIC_ICON, SOURCE_LABEL, comparisonText, dayLabel, formatAmount, formatRange, formatValue } from './format';

const WINDOWS = [7, 30] as const;

/**
 * One metric up close: a week or a month of days, the astronaut's usual range and goal on the
 * chart, plain stats, the goal (where one makes sense) and every reading with its source.
 */
@Component({
  selector: 'app-metric-detail',
  imports: [TrendChartComponent],
  host: { class: 'flex min-h-0 flex-col gap-2', '(keydown.escape)': 'onEscape($event)' },
  template: `
    <header class="flex flex-wrap items-center gap-2">
      <button #backBtn type="button" class="back soft-btn btn-press" (click)="back.emit()">← All metrics</button>
      <h3 class="flex items-center gap-1.5 text-lg font-extrabold"><span aria-hidden="true">{{ icon[metric()] }}</span>{{ def().label }}</h3>
      <div role="tablist" aria-label="Period" class="ml-auto grid grid-cols-2 gap-1.5">
        @for (n of windows; track n) {
          <button type="button" role="tab" class="console-tab btn-press period" [attr.aria-selected]="days() === n" (click)="days.set(n)">{{ n }} days</button>
        }
      </div>
    </header>

    <div class="split grid min-h-0 gap-2 @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section class="card riveted-card flex flex-col gap-1" aria-label="Chart">
        <app-trend-chart [metric]="metric()" [days]="s().days" [usual]="s().usual" [goal]="goal()" size="large" />
        <p class="text-xs text-bark/80">
          <span class="key band-key" aria-hidden="true"></span>Your usual{{ usualRange() ? ': ' + usualRange() : '' }}
          @if (goal() !== null) { <span class="ml-2"><span class="key goal-key" aria-hidden="true"></span>Your goal</span> }
        </p>
      </section>

      <div class="flex min-h-0 flex-col gap-2">
        <dl class="stats">
          <div><dt>Latest</dt><dd>{{ s().latest ? amount(s().latest!.value) : '—' }}</dd></div>
          @if (s().total !== null) {
            <div><dt>{{ days() }}-day total</dt><dd>{{ amount(s().total!) }}</dd></div>
          } @else {
            <div><dt>Average</dt><dd>{{ s().average !== null ? amount(s().average!) : '—' }}</dd></div>
          }
          <div><dt>Highest</dt><dd>{{ s().highest ? amount(s().highest!.value) : '—' }}<small>{{ s().highest ? dayLabel(s().highest!.day) : '' }}</small></dd></div>
          <div><dt>Lowest</dt><dd>{{ s().lowest ? amount(s().lowest!.value) : '—' }}<small>{{ s().lowest ? dayLabel(s().lowest!.day) : '' }}</small></dd></div>
        </dl>
        <p class="text-sm font-semibold">{{ comparison() }}</p>

        @if (goalMetric(); as gm) {
          <section class="card riveted-card goal" aria-label="Daily goal">
            <span class="font-bold">🎯 Daily goal</span>
            <span class="flex items-center gap-1.5">
              <button type="button" class="step soft-btn btn-press" [disabled]="goal()! <= limits(gm).min" [attr.aria-label]="'Lower the ' + def().label + ' goal'" (click)="changeGoal(-1)">−</button>
              <span class="min-w-14 text-center font-extrabold tabular-nums" aria-live="polite">{{ amount(goal()!) }}</span>
              <button type="button" class="step soft-btn btn-press" [disabled]="goal()! >= limits(gm).max" [attr.aria-label]="'Raise the ' + def().label + ' goal'" (click)="changeGoal(1)">+</button>
            </span>
            <span class="w-full text-xs text-bark/80">
              @if (todayValue() === null) { Not logged today. Reaching it pays +{{ perGoal }} seeds. }
              @else if (todayValue()! >= goal()!) { ✓ Reached today ({{ amount(todayValue()!) }}). }
              @else { {{ amount(todayValue()!) }} so far today. Reaching it pays +{{ perGoal }} seeds. }
            </span>
          </section>
        }
      </div>
    </div>

    <section class="card riveted-card readings" aria-labelledby="readings-title">
      <h4 id="readings-title" class="text-xs font-bold uppercase tracking-wide text-bark/70">Readings · newest first</h4>
      <ul class="min-h-0 overflow-y-auto overscroll-contain">
        @for (r of readings(); track r.id) {
          <li class="flex items-baseline justify-between gap-2 py-0.5 text-sm">
            <span class="text-bark/80">{{ dayLabel(day(r.measuredAt)) }} · {{ time(r.measuredAt) }}</span>
            <span class="ml-auto font-bold">{{ value(r) }}</span>
            <span class="w-28 text-right text-xs text-bark/70">{{ source[r.source] }}</span>
          </li>
        } @empty {
          <li class="text-sm text-bark/70">No readings in this period.</li>
        }
      </ul>
    </section>
    <p class="text-xs text-bark/80 short:hidden">{{ def().about }}</p>
  `,
  styles: `
    .card { padding: 10px 12px; }
    .back { padding: 0.3rem 0.75rem; border-radius: 8px; }
    .period { padding: 0.25rem 0.7rem; font-size: 0.85rem; }
    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 0; }
    .stats div { padding: 6px 8px; border-radius: 8px; background: color-mix(in srgb, var(--color-parchment) 60%, transparent); }
    .stats dt { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: color-mix(in srgb, var(--color-bark-dark) 70%, transparent); }
    .stats dd { margin: 0; font-weight: 800; }
    .stats small { display: block; font-size: 0.7rem; font-weight: 600; color: color-mix(in srgb, var(--color-bark-dark) 70%, transparent); }
    .goal { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
    .step { width: 2rem; height: 2rem; border-radius: 8px; font-size: 1.1rem; line-height: 1; }
    .readings { display: flex; min-height: 0; flex-direction: column; gap: 4px; }
    .readings ul { max-height: 8.5rem; margin: 0; padding: 0; list-style: none; }
    .key { display: inline-block; width: 14px; height: 8px; margin-right: 4px; vertical-align: 0; }
    .band-key { border-radius: 2px; background: color-mix(in srgb, var(--color-leaf) 30%, transparent); }
    .goal-key { border-top: 2px dashed color-mix(in srgb, var(--color-bark-dark) 60%, transparent); height: 0; vertical-align: 3px; }

    /* Same breakpoint as the short: variant in styles.css: on landscape phones the readings list scrolls in what's left. */
    @media (max-height: 500px) {
      /* Chart beside the numbers, so everything sits above the readings. */
      .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .card { padding: 4px 8px; }
      .stats { gap: 4px; }
      .stats div { padding: 2px 6px; }
      .stats dt { font-size: 0.6rem; }
      .stats dd { font-size: 0.85rem; }
      .stats small { display: none; }
      .goal { gap: 0 6px; }
      .goal .w-full { display: none; }
      .step { width: 1.6rem; height: 1.6rem; }
      .readings ul { max-height: 3.4rem; }
      .back, .period { padding: 0.15rem 0.6rem; font-size: 0.8rem; }
      h3 { font-size: 1rem; }
    }
  `,
})
export class MetricDetailComponent {
  readonly metric = input.required<HealthMetric>();
  readonly back = output<void>();

  protected readonly health = inject(HealthStore);
  protected readonly windows = WINDOWS;
  protected readonly days = signal<(typeof WINDOWS)[number]>(7);
  protected readonly icon = METRIC_ICON;
  protected readonly source = SOURCE_LABEL;
  protected readonly perGoal = HABIT_REWARD.perGoal;
  protected readonly dayLabel = dayLabel;
  protected readonly value = formatValue;
  private readonly backBtn = viewChild.required<ElementRef<HTMLButtonElement>>('backBtn');

  protected readonly def = computed(() => METRICS[this.metric()]);
  protected readonly s = computed(() => this.health.summary(this.metric(), this.days()));
  protected readonly goalMetric = computed(() => (isGoalMetric(this.metric()) ? this.metric() as keyof typeof GOALS : null));
  protected readonly goal = computed(() => {
    const gm = this.goalMetric();
    return gm ? goalTarget(this.health.goals(), gm) : null;
  });
  protected readonly todayValue = computed(() => this.health.today()[this.metric()]?.value ?? null);
  protected readonly usualRange = computed(() => (this.s().usual ? formatRange(this.metric(), this.s().usual!) : null));
  protected readonly comparison = computed(() => comparisonText(this.metric(), this.s()));
  /** Every reading in the period, newest first. */
  protected readonly readings = computed(() => {
    const from = this.s().days[0]?.day ?? '9999';
    return this.health.byMetric()[this.metric()].filter((r) => dayOf(r.measuredAt) >= from).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  });

  constructor() {
    effect(() => this.backBtn().nativeElement.focus());
  }

  protected amount(value: number): string {
    return formatAmount(this.metric(), value);
  }

  protected limits(metric: keyof typeof GOALS) {
    return GOALS[metric];
  }

  protected changeGoal(direction: 1 | -1): void {
    const gm = this.goalMetric();
    if (gm) this.health.setGoal(gm, clampGoal(gm, this.goal()! + direction * GOALS[gm].step));
  }

  protected day = dayOf;

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  }

  /** Esc goes back to all metrics before it closes the panel. */
  protected onEscape(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.back.emit();
  }
}
