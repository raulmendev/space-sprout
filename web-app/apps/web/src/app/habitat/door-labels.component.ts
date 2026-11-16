import { Component, computed, inject } from '@angular/core';
import { ROOMS, ROOM_COLS } from '@garden/shared';
import { HabitatStore } from './habitat.store';
import { colPct, rowPct } from './tile-percent';
import { t } from '../i18n/i18n';

/** Small signs by each door saying where it leads, so nobody has to be told. */
@Component({
  selector: 'app-door-labels',
  host: { class: 'pointer-events-none absolute inset-0' },
  template: `
    @for (s of signs(); track s.to) {
      <span
        class="absolute -translate-y-1/2 whitespace-nowrap rounded-md bg-night/75 px-1.5 py-0.5 text-[11px] font-bold text-cream"
        [style.top.%]="s.top"
        [style.left.%]="s.west ? s.left : null"
        [style.right.%]="s.west ? null : s.left"
      >{{ s.west ? '← ' + s.name : s.name + ' →' }}</span>
    }
  `,
})
export class DoorLabelsComponent {
  private readonly habitat = inject(HabitatStore);

  /** One sign per destination, centred on its door tiles, just inside the room. */
  protected readonly signs = computed(() => {
    const byTarget = new Map<string, { to: string; ys: number[]; west: boolean }>();
    for (const d of ROOMS[this.habitat.activeRoom()].doors) {
      const sign = byTarget.get(d.to) ?? { to: d.to, ys: [], west: d.x < ROOM_COLS / 2 };
      sign.ys.push(d.y);
      byTarget.set(d.to, sign);
    }
    return [...byTarget.values()].map((s) => ({
      ...s,
      name: t(ROOMS[s.to as keyof typeof ROOMS].name),
      top: rowPct((Math.min(...s.ys) + Math.max(...s.ys) + 1) / 2),
      left: colPct(1.15),
    }));
  });
}
