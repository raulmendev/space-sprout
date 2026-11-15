import { Component, computed, input } from '@angular/core';
import { DayValue, HealthMetric, METRICS, UsualRange } from '@garden/shared';
import { formatValue } from './format';

const SIZES = {
  small: { w: 280, h: 64, pad: { l: 30, r: 8, t: 8, b: 8 } },
  large: { w: 560, h: 170, pad: { l: 40, r: 12, t: 12, b: 22 } },
} as const;

/**
 * A metric's daily values as a line. Optional context, never a verdict: the astronaut's own
 * usual range as a soft band, and their own daily goal as a dashed line.
 */
@Component({
  selector: 'app-trend-chart',
  template: `
    @if (points().length > 1) {
      <svg [attr.viewBox]="'0 0 ' + s().w + ' ' + s().h" class="block w-full" role="img" [attr.aria-label]="summary()">
        @if (band(); as b) { <rect [attr.x]="s().pad.l" [attr.width]="s().w - s().pad.l - s().pad.r" [attr.y]="b.y" [attr.height]="b.h" class="band" /> }
        <text x="2" [attr.y]="s().pad.t + 4" class="axis">{{ label(range().hi) }}</text>
        <text x="2" [attr.y]="s().h - s().pad.b" class="axis">{{ label(range().lo) }}</text>
        <line [attr.x1]="s().pad.l" [attr.x2]="s().w - s().pad.r" [attr.y1]="s().h - s().pad.b" [attr.y2]="s().h - s().pad.b" class="base" />
        @if (goalY(); as y) {
          <line [attr.x1]="s().pad.l" [attr.x2]="s().w - s().pad.r" [attr.y1]="y" [attr.y2]="y" class="goal" />
          @if (size() === 'large') { <text [attr.x]="s().w - s().pad.r" [attr.y]="y - 4" class="axis goal-label" text-anchor="end">goal</text> }
        }
        <polyline [attr.points]="line()" class="line" />
        @for (p of points(); track p.day; let last = $last) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="last ? 4 : size() === 'large' ? 3 : 2.5" [class.latest]="last" class="dot" />
        }
        @if (size() === 'large') {
          <text [attr.x]="s().pad.l" [attr.y]="s().h - 4" class="axis">{{ shortDate(points()[0].day) }}</text>
          <text [attr.x]="s().w - s().pad.r" [attr.y]="s().h - 4" class="axis" text-anchor="end">{{ shortDate(points().at(-1)!.day) }}</text>
        }
      </svg>
    } @else {
      <p class="text-xs text-bark/60">A trend appears after two days of readings.</p>
    }
  `,
  styles: `
    .axis { font-size: 9px; fill: var(--color-bark); opacity: 0.75; }
    .base { stroke: var(--color-bark); stroke-opacity: 0.2; }
    .band { fill: var(--color-leaf); fill-opacity: 0.14; }
    .goal { stroke: var(--color-bark-dark); stroke-opacity: 0.55; stroke-width: 1.5; stroke-dasharray: 5 4; }
    .goal-label { opacity: 0.9; font-weight: 700; }
    .line { fill: none; stroke: var(--color-leaf-dark); stroke-width: 2; stroke-linejoin: round; }
    .dot { fill: var(--color-leaf-dark); }
    .dot.latest { fill: var(--color-sun); stroke: var(--color-bark-dark); stroke-width: 1.5; }
  `,
})
export class TrendChartComponent {
  readonly metric = input.required<HealthMetric>();
  readonly days = input.required<readonly DayValue[]>();
  readonly usual = input<UsualRange | null>(null);
  readonly goal = input<number | null>(null);
  readonly size = input<'small' | 'large'>('small');

  protected readonly s = computed(() => SIZES[this.size()]);

  /** Fits the values, the usual band and the goal; mood always shows its whole 1–5 scale. */
  protected readonly range = computed(() => {
    const def = METRICS[this.metric()];
    if (def.input === 'scale') return { lo: def.min, hi: def.max };
    const u = this.usual();
    const vals = [...this.days().map((d) => d.value), ...(u ? [u.lo, u.hi] : []), ...(this.goal() !== null ? [this.goal()!] : [])];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return lo === hi ? { lo: lo - 1, hi: hi + 1 } : { lo, hi };
  });

  private y(value: number): number {
    const { lo, hi } = this.range();
    const { h, pad } = this.s();
    return pad.t + (1 - (value - lo) / (hi - lo)) * (h - pad.t - pad.b);
  }

  protected readonly points = computed(() => {
    const ds = this.days();
    const { w, pad } = this.s();
    const n = Math.max(1, ds.length - 1);
    return ds.map((d, i) => ({ day: d.day, x: pad.l + (i / n) * (w - pad.l - pad.r), y: this.y(d.value) }));
  });

  protected readonly band = computed(() => {
    const u = this.usual();
    if (!u) return null;
    const top = this.y(u.hi);
    return { y: top, h: Math.max(2, this.y(u.lo) - top) };
  });

  protected readonly goalY = computed(() => (this.goal() === null ? null : this.y(this.goal()!)));

  protected readonly line = computed(() => this.points().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

  protected readonly summary = computed(() => {
    const ds = this.days();
    if (!ds.length) return '';
    const fmt = (value: number) => formatValue({ metric: this.metric(), value });
    return `${METRICS[this.metric()].label}, ${ds.length} days, from ${fmt(ds[0].value)} to ${fmt(ds.at(-1)!.value)}`;
  });

  protected label(value: number): string {
    return METRICS[this.metric()].input === 'scale' ? String(value) : String(+value.toFixed(2));
  }

  protected shortDate(day: string): string {
    return new Date(day + 'T12:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}
