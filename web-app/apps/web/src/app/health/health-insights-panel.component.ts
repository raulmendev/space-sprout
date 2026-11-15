import { Component, inject } from '@angular/core';
import { ALL_METRICS, HealthMetric, METRICS } from '@garden/shared';
import { HealthStore } from './health.store';
import { TrendChartComponent } from './trend-chart.component';
import { SOURCE_LABEL, formatValue, timeAgo } from './format';

/** Latest value, source, time and trend per metric. Descriptive only: no diagnosis. */
@Component({
  selector: 'app-health-insights-panel',
  imports: [TrendChartComponent],
  // Six readings: 3 + 3 when wide; on short (landscape phone) screens 3 across, so nothing scrolls.
  host: { class: 'grid gap-3 short:gap-2 @lg:grid-cols-2 short:@lg:grid-cols-3 @2xl:grid-cols-3' },
  template: `
    @for (metric of order; track metric) {
      @let readings = health.trends()[metric];
      @let latest = readings.at(-1);
      <article class="rounded-lg bg-parchment/70 p-3 short:p-2" [attr.aria-labelledby]="'metric-' + metric">
        <header class="flex items-baseline justify-between gap-2">
          <h3 [id]="'metric-' + metric" class="font-bold">{{ def(metric).label }}</h3>
          @if (latest) { <span class="text-lg font-extrabold">{{ value(latest) }}</span> }
        </header>
        @if (latest) {
          <p class="text-xs text-bark/70">{{ source[latest.source] }} · {{ ago(latest.measuredAt) }}</p>
          <app-trend-chart class="mt-1 block" [readings]="readings" />
        } @else {
          <p class="text-sm text-bark/70">No readings yet.</p>
        }
        <p class="mt-1 text-xs text-bark short:hidden">{{ def(metric).about }}</p>
      </article>
    }
    <p class="col-span-full text-[11px] text-bark/70">🔒 Private to you. Your own readings, newest on the right. This isn't a diagnosis; if something worries you, talk to your flight surgeon.</p>
  `,
})
export class HealthInsightsPanelComponent {
  protected readonly health = inject(HealthStore);
  protected readonly order = ALL_METRICS;
  protected readonly source = SOURCE_LABEL;
  protected def = (m: HealthMetric) => METRICS[m];
  protected value = formatValue;
  protected ago = (iso: string) => timeAgo(iso);
}
