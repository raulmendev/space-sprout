import { Component, inject } from '@angular/core';
import { HealthMetric, METRICS, METRIC_ORDER } from '@garden/shared';
import { HealthStore } from './health.store';
import { TrendChartComponent } from './trend-chart.component';
import { SOURCE_LABEL, formatValue, timeAgo } from './format';

/** Latest value, source, time and trend per metric. Descriptive only: no diagnosis. */
@Component({
  selector: 'app-health-insights-panel',
  imports: [TrendChartComponent],
  host: { class: 'grid gap-3 short:gap-2 @lg:grid-cols-2 @3xl:grid-cols-4' },
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
    <p class="text-[11px] text-bark/70 @lg:col-span-2 @3xl:col-span-4">🔒 Private to you. Your own readings, newest on the right. This isn't a diagnosis; if something worries you, talk to your flight surgeon.</p>
  `,
})
export class HealthInsightsPanelComponent {
  protected readonly health = inject(HealthStore);
  protected readonly order = METRIC_ORDER;
  protected readonly source = SOURCE_LABEL;
  protected def = (m: HealthMetric) => METRICS[m];
  protected value = formatValue;
  protected ago = (iso: string) => timeAgo(iso);
}
