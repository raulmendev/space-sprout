import { Component, computed, inject } from '@angular/core';
import { GardenStore } from '../garden.store';

const KIND_LABEL: Record<string, string> = {
  SOIL: 'Soil plot',
  GRASS: 'Grass',
  GRASS_FLOWERS: 'Wildflower patch',
  PATH: 'Garden path',
  HEDGE: 'Hedge',
};
const STAGE_LABEL = { SEED: 'Seed', SPROUT: 'Sprout', MATURE: 'Fully grown' } as const;

@Component({
  selector: 'app-tile-info',
  template: `
    <section class="panel p-3" aria-live="polite">
      <h2 class="font-pixel text-lg">Look closer</h2>
      @if (info(); as i) {
        @if (i.object && i.item && i.stage) {
          <p class="font-bold">{{ i.item.name }}</p>
          <p class="text-sm">
            {{ stageLabel[i.stage] }}
            @if (i.msToMature > 0) { · blooms in {{ countdown() }} }
          </p>
        } @else {
          <p class="font-bold">{{ kindLabel[i.kind ?? ''] ?? 'Somewhere' }}</p>
          <p class="text-sm text-bark">
            @switch (i.kind) {
              @case ('SOIL') { Ready for planting. }
              @case ('HEDGE') { Keeps the garden cozy. }
              @default { A nice place to stand and look around. }
            }
          </p>
        }
      } @else {
        <p class="text-sm text-bark">Tap any tile in the garden.</p>
      }
    </section>
  `,
})
export class TileInfoComponent {
  private readonly store = inject(GardenStore);
  protected readonly info = this.store.selectedInfo;
  protected readonly kindLabel = KIND_LABEL;
  protected readonly stageLabel = STAGE_LABEL;
  protected readonly countdown = computed(() => {
    const s = Math.ceil((this.info()?.msToMature ?? 0) / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  });
}
