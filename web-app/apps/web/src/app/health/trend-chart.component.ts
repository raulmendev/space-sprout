import { Component, computed, input } from '@angular/core';
import { HealthMeasurement, METRICS } from '@garden/shared';
import { formatValue } from './format';

const W = 280;
const H = 64;
const PAD = { l: 26, r: 8, t: 8, b: 8 };

/** Small inline SVG trend. Values only: no target bands, no thresholds. */
@Component({
  selector: 'app-trend-chart',
  template: `
    @if (points().length > 1) {
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="block w-full" role="img" [attr.aria-label]="summary()">
        <text [attr.x]="2" [attr.y]="pad.t + 4" class="axis">{{ range().hi }}</text>
        <text [attr.x]="2" [attr.y]="h - pad.b" class="axis">{{ range().lo }}</text>
        <line [attr.x1]="pad.l" [attr.x2]="w - pad.r" [attr.y1]="h - pad.b" [attr.y2]="h - pad.b" class="base" />
        <polyline [attr.points]="line()" class="line" />
        @for (p of points(); track $index; let last = $last) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="last ? 4 : 2.5" [class.latest]="last" class="dot" />
        }
      </svg>
    } @else {
      <p class="text-xs text-bark/60">A trend appears after two readings.</p>
    }
  `,
  styles: `
    .axis { font-size: 9px; fill: var(--color-bark); opacity: 0.7; }
    .base { stroke: var(--color-bark); stroke-opacity: 0.2; }
    .line { fill: none; stroke: var(--color-leaf-dark); stroke-width: 2; stroke-linejoin: round; }
    .dot { fill: var(--color-leaf-dark); }
    .dot.latest { fill: var(--color-sun); stroke: var(--color-bark-dark); stroke-width: 1.5; }
  `,
})
export class TrendChartComponent {
  readonly readings = input.required<HealthMeasurement[]>();
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;

  protected readonly range = computed(() => {
    const vals = this.readings().map((r) => r.value);
    const def = this.readings()[0] ? METRICS[this.readings()[0].metric] : null;
    if (def?.input === 'scale') return { lo: def.min, hi: def.max };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return lo === hi ? { lo: lo - 1, hi: hi + 1 } : { lo, hi };
  });

  protected readonly points = computed(() => {
    const rs = this.readings();
    const { lo, hi } = this.range();
    const n = Math.max(1, rs.length - 1);
    return rs.map((r, i) => ({
      x: PAD.l + (i / n) * (W - PAD.l - PAD.r),
      y: PAD.t + (1 - (r.value - lo) / (hi - lo)) * (H - PAD.t - PAD.b),
    }));
  });

  protected readonly line = computed(() => this.points().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

  protected readonly summary = computed(() => {
    const rs = this.readings();
    if (!rs.length) return '';
    const label = METRICS[rs[0].metric].label;
    return `${label}, last ${rs.length} readings, from ${formatValue(rs[0])} to ${formatValue(rs[rs.length - 1])}`;
  });
}
