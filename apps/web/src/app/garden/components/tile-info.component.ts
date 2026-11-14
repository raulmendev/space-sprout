import { Component, inject } from '@angular/core';
import { ZONES } from '@garden/shared';
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
    <section class="panel p-4" aria-live="polite">
      <h2 class="font-pixel text-lg">Look closer</h2>
      @if (info(); as i) {
        <p class="font-bold">{{ i.title ?? label(i.kind)[0] }}</p>
        @if (i.zone) { <p class="text-xs font-bold uppercase tracking-wide text-bark/70">{{ zones[i.zone].label }}</p> }
        @if (!i.title && label(i.kind)[1]) { <p class="text-sm text-bark">{{ label(i.kind)[1] }}</p> }
      } @else {
        <p class="text-sm text-bark">Garden, medical station and social space, all under one roof.</p>
      }
    </section>
  `,
})
export class TileInfoComponent {
  protected readonly info = inject(HabitatStore).selectedInfo;
  protected readonly zones = ZONES;
  protected label = (kind: string | null) => KIND_LABEL[kind ?? ''] ?? ['Somewhere', ''];
}
