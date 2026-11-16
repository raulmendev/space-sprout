import { Component, computed, inject } from '@angular/core';
import { ROOMS, ROOM_COLS, ROOM_ROWS } from '@garden/shared';
import { HabitatStore } from './habitat.store';
import { colPct, rowPct } from './tile-percent';
import { t } from '../i18n/i18n';

/** Layout-checkpoint aid: the active room's bounds, object footprints and doors. */
@Component({
  selector: 'app-layout-overlay',
  host: { class: 'pointer-events-none absolute inset-0' },
  template: `
    <span class="absolute left-1 top-1 bg-night/80 px-1 text-[11px] font-bold text-sun">{{ t(room().name) }} · {{ cols }}×{{ rows }}</span>
    @for (p of room().props; track p.id) {
      <div class="absolute border border-cream/90 bg-cream/10" [style.left.%]="col(p.x)" [style.top.%]="row(p.y)" [style.width.%]="col(p.w)" [style.height.%]="row(p.h)">
        <span class="absolute bottom-0 right-0 bg-night/70 px-0.5 text-[9px] text-cream">{{ p.w }}×{{ p.h }}</span>
      </div>
    }
    @for (d of room().doors; track $index) {
      <div class="absolute border-2 border-dashed border-sun/90" [style.left.%]="col(d.x)" [style.top.%]="row(d.y)" [style.width.%]="col(1)" [style.height.%]="row(1)"></div>
    }
  `,
})
export class LayoutOverlayComponent {
  private readonly habitat = inject(HabitatStore);
  protected readonly room = computed(() => ROOMS[this.habitat.activeRoom()]);
  protected readonly t = t;
  protected readonly cols = ROOM_COLS;
  protected readonly rows = ROOM_ROWS;
  protected readonly col = colPct;
  protected readonly row = rowPct;
}
