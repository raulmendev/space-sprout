import { Component, DestroyRef, ElementRef, Injector, afterNextRender, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HealthMeasurement, HealthMetric, METRICS, goalTarget, isGoalMetric } from '@garden/shared';
import { MY_METRICS } from '../session/current-user';
import { HealthStore } from './health.store';
import { TrendChartComponent } from './trend-chart.component';
import { MetricDetailComponent } from './metric-detail.component';
import { METRIC_ICON, SOURCE_LABEL, comparisonText, formatAmount, formatValue, timeAgo } from './format';
import { t } from '../i18n/i18n';

/**
 * Health Insights, a station console: the check-in streak and today's goals, then a card per
 * metric (latest value, the week against the astronaut's own usual range). A card opens the
 * metric in detail. Descriptive only: no diagnosis, no "good" or "bad" values.
 *
 * On landscape phones the cards become slides of two, swiped (or paged) sideways, so each card
 * keeps room for its source, chart and full comparison. The slides loop: a copy of the last
 * slide sits before the first and a copy of the first after the last; when a swipe settles on
 * a copy, the row jumps (invisibly) to the real slide. The copies only show on phones and are
 * hidden from assistive tech and the keyboard.
 */
const PER_SLIDE = 2;
const SLIDE_COUNT = Math.ceil(MY_METRICS.length / PER_SLIDE);
/** Cards in row order: [copy of last slide] real slides [copy of first slide]. */
const LOOP = [
  ...MY_METRICS.slice(-PER_SLIDE).map((metric) => ({ metric, copy: true })),
  ...MY_METRICS.map((metric) => ({ metric, copy: false })),
  ...MY_METRICS.slice(0, PER_SLIDE).map((metric) => ({ metric, copy: true })),
];

@Component({
  selector: 'app-health-insights-panel',
  imports: [TrendChartComponent, MetricDetailComponent],
  host: { class: 'console-screen flex min-h-0 flex-1 flex-col gap-3 short:gap-2' },
  template: `
    @if (detail(); as metric) {
      <app-metric-detail [metric]="metric" (back)="closeDetail()" />
    } @else {
      <section class="habits" [attr.aria-label]="t('Streak and goals')">
        <p class="flex items-center gap-2">
          <span class="text-2xl leading-none short:text-xl" aria-hidden="true">🔥</span>
          <span>
            <b>{{ streak().length ? t('{n}-day streak', { n: streak().length }) : t('No streak yet') }}</b>
            <small class="block">
              @if (!streak().checkedInToday) { {{ streak().length ? t('Check in today to keep it going.') : t('Check in today to start one.') }} }
              @else if (streak().next; as next) { {{ t('+{amount} seeds at {days} days.', { amount: next.amount, days: next.days }) }} }
              @else { {{ t('Every day counts.') }} }
            </small>
          </span>
        </p>
        <ul class="goals" [attr.aria-label]="t('Today\\'s goals')">
          @for (g of health.goalProgress(); track g.metric) {
            <li [class.met]="g.met" [attr.aria-label]="goalLabel(g)">
              <span aria-hidden="true">{{ icon[g.metric] }}</span>
              {{ g.value === null ? '—' : amountOnly(g.metric, g.value) }} / {{ amount(g.metric, g.target) }}
              @if (g.met) { <span aria-hidden="true">✓</span> }
            </li>
          }
        </ul>
      </section>

      <div class="cards" #cards role="group" [attr.aria-label]="t('Metrics')" (scroll)="onScroll()">
        @for (item of loop; track $index) {
          @let metric = item.metric;
          @let s = health.cards()[metric];
          <button
            type="button"
            class="card riveted-card"
            [class.copy]="item.copy"
            [attr.id]="item.copy ? null : 'card-' + metric"
            [attr.tabindex]="item.copy ? -1 : null"
            [attr.aria-hidden]="item.copy || null"
            (click)="openDetail(metric)"
            [attr.aria-label]="t('{metric}: details', { metric: t(def(metric).label) })"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="label"><span aria-hidden="true">{{ icon[metric] }}</span>{{ t(def(metric).label) }}</span>
              @if (s.latest) { <span class="value">{{ amount(metric, s.latest.value) }}</span> }
            </span>
            @if (latestReading(metric); as r) {
              <span class="meta">{{ t(source[r.source]) }} · {{ ago(r.measuredAt) }}</span>
              <app-trend-chart class="chart" [metric]="metric" [days]="s.days" [usual]="s.usual" [goal]="goalOf(metric)" />
              <span class="insight">{{ s.total !== null ? t('7-day total {amount}', { amount: amount(metric, s.total) }) : comparison(metric) }}</span>
            } @else {
              <span class="meta">{{ t('No readings yet.') }}</span>
            }
          </button>
        }
      </div>
      <nav class="pager" [attr.aria-label]="t('Metric pages')">
        <button type="button" class="arrow soft-btn btn-press" [attr.aria-label]="t('Previous metrics')" (click)="step(-1)">‹</button>
        @for (i of slides; track i) {
          <button type="button" class="dot" [class.on]="slide() === i" [attr.aria-current]="slide() === i" [attr.aria-label]="slideLabel(i)" (click)="goTo(i)"></button>
        }
        <button type="button" class="arrow soft-btn btn-press" [attr.aria-label]="t('Next metrics')" (click)="step(1)">›</button>
      </nav>
      <p class="text-[11px] text-bark/75">🔒 {{ t('Private to you: your own readings, compared only with your own usual. Not a diagnosis; if something worries you, talk to your flight surgeon.') }}</p>
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

    /*
     * A card per metric: rows of three when there's room, two columns on narrow screens. The
     * popup has a fixed height, so the cards scroll inside the screen (the streak and the privacy
     * note stay put); the padding keeps the cards' rivets and focus ring from being clipped.
     */
    .cards {
      display: grid;
      flex: 1;
      min-height: 0;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: start;
      gap: 10px;
      padding: 3px;
      overflow-y: auto;
    }
    @container (min-width: 40rem) { .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; text-align: left; }
    .card:hover { filter: brightness(1.03); }
    .card:focus-visible { outline: 2px solid var(--color-steel); outline-offset: 2px; }
    .label { display: flex; min-width: 0; align-items: center; gap: 0.375rem; overflow: hidden; font-weight: 700; white-space: nowrap; }
    .value { font-size: 1.15rem; font-weight: 800; white-space: nowrap; }
    .meta { font-size: 0.72rem; color: color-mix(in srgb, var(--color-bark-dark) 70%, transparent); }
    .chart { display: block; margin-top: 2px; }
    .insight { font-size: 0.75rem; font-weight: 700; color: var(--color-bark-dark); }
    .pager, .copy { display: none; }

    /* Same breakpoint as the short: variant in styles.css: slides of two cards, swiped or paged sideways. */
    @media (max-height: 500px) {
      .habits { flex-wrap: nowrap; padding: 3px 10px; }
      .habits small { display: none; }
      .goals { flex-wrap: nowrap; gap: 4px; }
      .goals li { padding: 0 6px; font-size: 0.7rem; }
      .cards {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: calc((100% - 12px) / 2);
        gap: 12px;
        overflow: auto hidden;
        scroll-snap-type: x mandatory;
        scroll-padding-inline: 3px;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
      }
      .cards::-webkit-scrollbar { display: none; }
      .card { scroll-snap-align: start; padding: 6px 10px; }
      .copy { display: flex; }
      .pager { display: flex; align-items: center; justify-content: center; gap: 8px; }
      .arrow { width: 1.9rem; height: 1.5rem; border-radius: 8px; font-size: 1.1rem; line-height: 1; }
      .dot { width: 10px; height: 10px; padding: 0; border: 2px solid var(--color-bark-dark); border-radius: 50%; background: transparent; }
      .dot.on { background: var(--color-sun); }
      .dot:focus-visible { outline: 2px solid var(--color-steel); outline-offset: 2px; }
    }
  `,
})
export class HealthInsightsPanelComponent {
  protected readonly health = inject(HealthStore);
  protected readonly t = t;
  private readonly injector = inject(Injector);
  protected readonly loop = LOOP;
  protected readonly icon = METRIC_ICON;
  protected readonly source = SOURCE_LABEL;
  protected readonly streak = this.health.streak;
  protected readonly ago = timeAgo;

  /** The metric opened in detail, if any. */
  protected readonly detail = signal<HealthMetric | null>(null);

  /** Phone slides: which one is showing (the pager only appears on short screens). */
  protected readonly slides = Array.from({ length: SLIDE_COUNT }, (_, i) => i);
  /** The real slide showing (0-based). */
  protected readonly slide = signal(0);
  private readonly cardsEl = viewChild<ElementRef<HTMLElement>>('cards');
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private settleTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Whenever the row (re)appears, start on the current real slide, not on the copy before it.
    effect(() => {
      if (!this.cardsEl()) return;
      afterNextRender(() => this.jump(untracked(this.slide) + 1), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.settleTimer));
  }

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
    const name = t(METRICS[g.metric].label);
    const target = formatAmount(g.metric, g.target);
    if (g.value === null) return t('{metric} goal {target}: not logged today', { metric: name, target });
    const value = formatValue({ metric: g.metric, value: g.value });
    return g.met ? t('{metric}: {value} of {target}, reached', { metric: name, value, target }) : t('{metric}: {value} of {target}', { metric: name, value, target });
  }

  /**
   * Where each position in the row starts, in scroll coordinates: 0 is the copy of the last
   * slide, 1..SLIDE_COUNT the real slides, SLIDE_COUNT + 1 the copy of the first.
   */
  private positions(): number[] {
    const el = this.cardsEl()?.nativeElement;
    if (!el) return [];
    const cards = [...el.children] as HTMLElement[];
    return Array.from({ length: SLIDE_COUNT + 2 }, (_, k) => cards[k * PER_SLIDE].offsetLeft - cards[0].offsetLeft);
  }

  /** The row position nearest to where it's scrolled. */
  private nearest(): number {
    const left = this.cardsEl()!.nativeElement.scrollLeft;
    const pos = this.positions();
    return pos.reduce((best, x, k) => (Math.abs(x - left) < Math.abs(pos[best] - left) ? k : best), 0);
  }

  protected onScroll(): void {
    this.slide.set((this.nearest() - 1 + SLIDE_COUNT) % SLIDE_COUNT);
    // Once the swipe settles on a copy, swap to the real slide it shows.
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      const k = this.nearest();
      if (k === 0) this.jump(SLIDE_COUNT);
      else if (k === SLIDE_COUNT + 1) this.jump(1);
    }, 120);
  }

  /** Move to row position `k` instantly (no animation). */
  private jump(k: number): void {
    const left = this.positions()[k];
    if (left !== undefined) this.cardsEl()!.nativeElement.scrollTo({ left, behavior: 'instant' });
  }

  /** Scroll to row position `k`. */
  private glide(k: number): void {
    const left = this.positions()[k];
    if (left !== undefined) this.cardsEl()!.nativeElement.scrollTo({ left, behavior: this.reducedMotion ? 'instant' : 'smooth' });
  }

  /** Arrows: one slide along, through the copy at either end, so the loop looks continuous. */
  protected step(direction: 1 | -1): void {
    this.glide(this.slide() + 1 + direction);
  }

  protected goTo(i: number): void {
    this.glide(i + 1);
  }

  /** "Heart rate and Sleep". */
  protected slideLabel(i: number): string {
    const [a, b] = MY_METRICS.slice(i * PER_SLIDE, (i + 1) * PER_SLIDE).map((m) => t(METRICS[m].label));
    return b ? t('{a} and {b}', { a, b }) : a;
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
