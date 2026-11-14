import { Component, inject } from '@angular/core';
import { HabitatStore } from '../../habitat/habitat.store';

const KIND_LABEL: Record<string, [string, string]> = {
  SOIL: ['Soil plot', 'Ready for planting.'],
  GRASS: ['Grass', 'Soft underfoot, even in orbit.'],
  GRASS_FLOWERS: ['Wildflower patch', 'They came in on a supply run.'],
  PATH_STONE: ['Stone path', 'Leads through the garden.'],
  PATH_WOOD: ['Wooden walkway', 'Connects the garden to the rest of home.'],
  HEDGE: ['Hedge', 'Keeps the garden cozy.'],
  FLOOR_MEDICAL: ['Medical station', 'Calm, clean and quiet.'],
  FLOOR_SOCIAL: ['Social space', 'A warm place for notes from home.'],
  RUG: ['Rug', 'The comfiest spot in the habitat.'],
  WALL: ['Habitat wall', ''],
  WALL_FACE: ['Habitat wall', ''],
  WINDOW: ['Window', 'Stars, as far as you can see.'],
  WINDOW_EARTH_L: ['Earth window', 'Home is right there.'],
  WINDOW_EARTH_R: ['Earth window', 'Home is right there.'],
  GLASS_PARTITION: ['Glass partition', ''],
  LOW_WALL: ['Low wall', ''],
  DOORWAY: ['Doorway', ''],
};

@Component({
  selector: 'app-tile-info',
  template: `
    @if (info(); as i) {
      <section class="panel px-3 py-2" aria-live="polite" aria-label="Look closer">
        <p class="text-sm font-bold leading-tight">{{ i.title ?? label(i.kind)[0] }}
          <span class="ml-1 text-[11px] font-bold uppercase tracking-wide text-bark/60">{{ i.roomName }}</span>
        </p>
        @if (!i.title && label(i.kind)[1]) { <p class="text-xs text-bark">{{ label(i.kind)[1] }}</p> }
      </section>
    }
  `,
})
export class TileInfoComponent {
  protected readonly info = inject(HabitatStore).selectedInfo;
  protected label = (kind: string | null) => KIND_LABEL[kind ?? ''] ?? ['Somewhere', ''];
}
