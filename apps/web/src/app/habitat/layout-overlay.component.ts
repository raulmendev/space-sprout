import { Component } from '@angular/core';
import { HABITAT_PROPS, ZONES } from '@garden/shared';
import { colPct, rowPct } from './tile-percent';

/** Layout-checkpoint aid: zone boundaries and object footprints over the habitat. */
@Component({
  selector: 'app-layout-overlay',
  host: { class: 'pointer-events-none absolute inset-0' },
  template: `
    @for (z of zones; track z.label) {
      <div class="absolute border-2 border-dashed border-sun/90" [style.left.%]="col(z.x)" [style.top.%]="row(z.y)" [style.width.%]="col(z.w)" [style.height.%]="row(z.h)">
        <span class="absolute left-0 top-0 bg-night/80 px-1 text-[11px] font-bold text-sun">{{ z.label }} · {{ z.w }}×{{ z.h }}</span>
      </div>
    }
    @for (p of props; track p.id) {
      <div class="absolute border border-cream/90 bg-cream/10" [style.left.%]="col(p.x)" [style.top.%]="row(p.y)" [style.width.%]="col(p.w)" [style.height.%]="row(p.h)">
        <span class="absolute bottom-0 right-0 bg-night/70 px-0.5 text-[9px] text-cream">{{ p.w }}×{{ p.h }}</span>
      </div>
    }
  `,
})
export class LayoutOverlayComponent {
  protected readonly zones = Object.values(ZONES);
  protected readonly props = HABITAT_PROPS;
  protected readonly col = colPct;
  protected readonly row = rowPct;
}
