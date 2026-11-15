import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { HealthMeasurement, HealthMetric, METRICS, METRIC_ORDER, goalTarget, isGoalMetric } from '@garden/shared';
import { HealthStore } from './health.store';
import { TrendChartComponent } from './trend-chart.component';
import { MetricDetailComponent } from './metric-detail.component';
import { METRIC_ICON, SOURCE_LABEL, comparisonText, formatAmount, formatValue, timeAgo } from './format';

/**
 * Health Insights, a station console: the check-in streak and today's goals, then a card per
 * metric (latest value, the week against the astronaut's own usual range). A card opens the
 * metric in detail. Descriptive only: no diagnosis, no "good" or "bad" values.
 */
@Component({
  selector: 'app-health-insights-panel',
  imports: [TrendChartComponent, MetricDetailComponent],
  host: { class: 'console-screen flex min-h-0 flex-col gap-3 short:gap-2' },
  template: `
    @if (detail(); as metric) {
      <app-metric-detail [metric]="metric" (back)="closeDetail()" />
    } @else {
      <section class="habits" aria-label="Streak and goals">
        <p class="flex items-center gap-2">
          <span class="text-2xl leading-none short:text-xl" aria-hidden="true">🔥</span>
          <span>
            <b>{{ streak().length ? streak().length + '-day check-in streak' : 'No streak yet' }}</b>
            <small class="block">
              @if (!streak().checkedInToday) { Check in today to {{ streak().length ? 'keep it going' : 'start one' }}. }
              @else if (streak().next; as next) { +{{ next.amount }} seeds at {{ next.days }} days. }
              @else { Every day counts. }
            </small>
          </span>
        </p>
        <ul class="goals" aria-label="Today's goals">
          @for (g of health.goalProgress(); track g.metric) {
            <li [class.met]="g.met" [attr.aria-label]="goalLabel(g)">
              <span aria-hidden="true">{{ icon[g.metric] }}</span>
              {{ g.value === null ? '—' : amountOnly(g.metric, g.value) }} / {{ amount(g.metric, g.target) }}
              @if (g.met) { <span aria-hidden="true">✓</span> }
            </li>
          }
        </ul>
      </section>

      <div class="cards">
        @for (metric of order; track metric) {
          @let s = health.cards()[metric];
          <button type="button" class="card riveted-card" [id]="'card-' + metric" (click)="openDetail(metric)" [attr.aria-label]="def(metric).label + ': details'">
            <span class="flex items-baseline justify-between gap-2">
              <span class="label"><span aria-hidden="true">{{ icon[metric] }}</span>{{ def(metric).label }}</span>
              @if (s.latest) { <span class="value">{{ amount(metric, s.latest.value) }}</span> }
            </span>
            @if (latestReading(metric); as r) {
              <span class="meta">{{ source[r.source] }} · {{ ago(r.measuredAt) }}</span>
              <app-trend-chart class="chart" [metric]="metric" [days]="s.days" [usual]="s.usual" [goal]="goalOf(metric)" />
              <span class="insight">{{ s.total !== null ? '7-day total ' + amount(metric, s.total) : comparison(metric) }}</span>
            } @else {
              <span class="meta">No readings yet.</span>
            }
          </button>
        }
      </div>
      <p class="text-[11px] text-bark/75">🔒 Private to you: your own readings, compared only with your own usual. Not a diagnosis; if something worries you, talk to your flight surgeon.</p>
    }
  `,
  styles: `
    :host { --stripe: color-mix(in srgb, var(--color-steel) 25%, transparent); }

    .habits {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 16px;
      padding: 6px 12px;
      border: 2px solid var(--line);
      border-radius: 10px;
      background: #fffaf0;
    }
    .habits small { font-size: 0.75rem; color: color-mix(in srgb, var(--color-bark-dark) 75%, transparent); }
    .goals { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .goals li {
      padding: 2px 10px;
      border: 2px solid color-mix(in srgb, var(--color-bark) 25%, transparent);
      border-radius: 999px;
      background: var(--color-cream);
      font-size: 0.8rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .goals li.met { border-color: var(--color-leaf); background: color-mix(in srgb, var(--color-leaf) 18%, transparent); color: var(--color-leaf-dark); }

    /* Six cards: two rows of three when there's room, two columns on narrow screens. */
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    @container (min-width: 40rem) { .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; text-align: left; }
    .card:hover { filter: brightness(1.03); }
    .card:focus-visible { outline: 2px solid var(--color-steel); outline-offset: 2px; }
    .label { display: flex; min-width: 0; align-items: center; gap: 0.375rem; overflow: hidden; font-weight: 700; white-space: nowrap; }
    .value { font-size: 1.15rem; font-weight: 800; white-space: nowrap; }
    .meta { font-size: 0.72rem; color: color-mix(in srgb, var(--color-bark-dark) 70%, transparent); }
    .chart { display: block; margin-top: 2px; }
    .insight { font-size: 0.75rem; font-weight: 700; color: var(--color-bark-dark); }

    /* Same breakpoint as the short: variant in styles.css: three across, the essentials only. */
    @media (max-height: 500px) {
      .habits { flex-wrap: nowrap; padding: 3px 10px; }
      .habits small { display: none; }
      .goals { flex-wrap: nowrap; gap: 4px; }
      .goals li { padding: 0 6px; font-size: 0.7rem; }
      .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .card { padding: 4px 8px; font-size: 0.85rem; }
      .meta { display: none; }
      .value { font-size: 0.9rem; }
      .chart { height: 1.9rem; overflow: hidden; }
      .insight { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 0.66rem; }
    }
  `,
})
export class HealthInsightsPanelComponent {
  protected readonly health = inject(HealthStore);
  private readonly injector = inject(Injector);
  protected readonly order = METRIC_ORDER;
  protected readonly icon = METRIC_ICON;
  protected readonly source = SOURCE_LABEL;
  protected readonly streak = this.health.streak;
  protected readonly ago = timeAgo;

  /** The metric opened in detail, if any. */
  protected readonly detail = signal<HealthMetric | null>(null);

  protected def = (m: HealthMetric) => METRICS[m];
  protected amount = formatAmount;
  /** "1.5" for "1.5 / 2 L". */
  protected amountOnly = (m: HealthMetric, v: number) => formatAmount(m, v).split(' ')[0];
  protected comparison = (m: HealthMetric) => comparisonText(m, this.health.cards()[m]);

  protected goalOf(metric: HealthMetric): number | null {
    return isGoalMetric(metric) ? goalTarget(this.health.goals(), metric) : null;
  }

  protected latestReading(metric: HealthMetric): HealthMeasurement | null {
    return this.health.byMetric()[metric].reduce<HealthMeasurement | null>((latest, r) => (!latest || r.measuredAt > latest.measuredAt ? r : latest), null);
  }

  protected goalLabel(g: { metric: HealthMetric; value: number | null; target: number; met: boolean }): string {
    const name = METRICS[g.metric].label;
    const target = formatAmount(g.metric, g.target);
    if (g.value === null) return `${name} goal ${target}: not logged today`;
    return `${name}: ${formatValue({ metric: g.metric, value: g.value })} of ${target}${g.met ? ', reached' : ''}`;
  }

  protected openDetail(metric: HealthMetric): void {
    this.detail.set(metric);
  }

  /** Back to all metrics, with focus on the card that was open. */
  protected closeDetail(): void {
    const metric = this.detail();
    this.detail.set(null);
    afterNextRender(() => document.getElementById('card-' + metric)?.focus(), { injector: this.injector });
  }
}
