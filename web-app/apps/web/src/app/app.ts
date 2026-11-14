import { Component, inject, signal, viewChild } from '@angular/core';
import { HabitatInteraction, PlacementError, isWalkable } from '@garden/shared';
import { GardenStore } from './garden/garden.store';
import { PlantPickerComponent } from './garden/components/plant-picker.component';
import { PlantCloseupComponent } from './garden/components/plant-closeup.component';
import { TileInfoComponent } from './garden/components/tile-info.component';
import { DialogueBubbleComponent } from './npc/dialogue-bubble.component';
import { NpcStore } from './npc/npc.store';
import { HabitatStore } from './habitat/habitat.store';
import { PlayerStore } from './habitat/player.store';
import { HabitatCanvasComponent } from './habitat/habitat-canvas.component';
import { LayoutOverlayComponent } from './habitat/layout-overlay.component';
import { StationPanelComponent } from './habitat/panels/station-panel.component';
import type { TileCoord } from './garden/game/tile-manager';

const GENTLE_ERRORS: Record<PlacementError, string> = {
  INSUFFICIENT_FUNDS: 'Not quite enough seeds for that one yet.',
  TILE_OCCUPIED: 'That needs a bit more room.',
  NOT_PLANTABLE: 'That needs a bit more soil.',
  OUT_OF_BOUNDS: "That's outside the garden.",
  UNKNOWN_ITEM: "Hmm, I don't recognise that seed.",
};

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
};

@Component({
  selector: 'app-root',
  host: { '(document:keydown)': 'onKey($event)' },
  imports: [
    HabitatCanvasComponent,
    LayoutOverlayComponent,
    PlantPickerComponent,
    PlantCloseupComponent,
    TileInfoComponent,
    StationPanelComponent,
    DialogueBubbleComponent,
  ],
  template: `
    <div class="mx-auto flex min-h-full max-w-[1400px] flex-col gap-3 p-4">
      <header class="flex flex-wrap items-center justify-between gap-3 text-cream">
        <div>
          <h1 class="font-pixel text-3xl leading-none">Jardín Comunal</h1>
          <p class="text-sm text-cream/70">A home in orbit: garden, health and connection.</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-cream/80">
            <input type="checkbox" class="accent-sun" [checked]="habitat.showLayout()" (change)="habitat.showLayout.set(!habitat.showLayout())" />
            Show layout
          </label>
          <span class="panel px-3 py-1 text-lg font-extrabold text-bark-dark" aria-label="Seeds balance">🌱 {{ garden.balance() }}</span>
          <button type="button" class="rounded-md px-2 py-1 text-xs text-cream/60 hover:text-cream" (click)="reset()">reset demo</button>
        </div>
      </header>

      <main class="flex flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        <div class="relative min-w-0 flex-1" data-habitat-slot>
          <div class="mx-auto w-fit rounded-xl border-4 border-bark-dark bg-bark p-1.5 shadow-[0_8px_0_rgb(0_0_0/0.3)]">
            <div class="relative">
              <app-habitat-canvas (interaction)="onInteraction($event)" />
              @if (habitat.showLayout()) { <app-layout-overlay /> }
              @if (garden.pickerTile(); as t) {
                <app-plant-picker [tile]="t" (picked)="plantAt(t, $event)" (closed)="garden.pickerTile.set(null)" />
              }
              @if (garden.closeup(); as c) {
                <app-plant-closeup [info]="c" (closed)="garden.closeupId.set(null)" />
              }
              @if (!garden.closeup()) {
                <div class="pointer-events-none absolute bottom-3 left-3 w-[min(30rem,calc(100%-1.5rem))] [&>*]:pointer-events-auto">
                  <app-dialogue-bubble (action)="onDialogueAction($event)" />
                </div>
              }
              @if (notice(); as n) {
                <div class="panel absolute left-1/2 top-3 -translate-x-1/2 px-3 py-1 text-sm font-bold" role="status">{{ n }}</div>
              }
            </div>
          </div>
        </div>

        <aside class="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
          @if (habitat.openPanel(); as p) {
            <app-station-panel [panel]="p" (closed)="habitat.openPanel.set(null)" />
          } @else {
            <app-tile-info />
          }
        </aside>
      </main>
    </div>
  `,
})
export class App {
  protected readonly garden = inject(GardenStore);
  protected readonly habitat = inject(HabitatStore);
  protected readonly npc = inject(NpcStore);
  private readonly player = inject(PlayerStore);
  protected readonly notice = signal<string | null>(null);
  private readonly canvas = viewChild.required(HabitatCanvasComponent);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.garden.init().then(() => setTimeout(() => this.npc.say('GREETING'), 600));
  }

  /**
   * Every click in the habitat lands here. Floor → walk there. Anything else →
   * walk up to it, then act on it. The thing clicked is the thing acted on.
   */
  onInteraction(raw: HabitatInteraction): void {
    const i = this.habitat.resolve(raw);
    const plot = this.garden.pickerTile();
    this.garden.pickerTile.set(null);
    this.garden.closeupId.set(null);
    this.habitat.selection.set(i.type === 'NPC_SELECTED' ? this.habitat.selection() : i);

    if (i.type === 'TILE_SELECTED' && isWalkable(i.x, i.y, this.garden.objects())) {
      this.player.walkTo(i);
      return;
    }
    const rect = this.habitat.targetRect(i);
    if (rect) this.player.approach(rect, () => this.act(i, plot));
    else this.act(i, plot);
  }

  private act(i: HabitatInteraction, plot: TileCoord | null): void {
    switch (i.type) {
      case 'PLANT_SELECTED':
        this.garden.closeupId.set(i.plantId);
        break;
      case 'PLOT_SELECTED': {
        const same = plot?.x === i.x && plot?.y === i.y;
        if (!same && this.garden.isEmptyPlot(i)) this.garden.pickerTile.set({ x: i.x, y: i.y });
        break;
      }
      case 'MEDICAL_TERMINAL_SELECTED':
      case 'HEALTH_INSIGHTS_SELECTED':
      case 'MESSAGE_BOARD_SELECTED':
      case 'EMOTE_AREA_SELECTED':
        this.habitat.openPanel.set(i.type);
        break;
      case 'NPC_SELECTED':
        this.npc.talk();
        break;
      case 'TILE_SELECTED':
      case 'PROP_SELECTED':
        this.habitat.openPanel.set(null);
        break;
    }
  }

  async plantAt(tile: TileCoord, item: string): Promise<void> {
    this.garden.pickerTile.set(null);
    const result = await this.garden.plant(item, tile);
    if (!result.ok) {
      this.canvas().flashTile(tile);
      this.flash(GENTLE_ERRORS[result.error]);
      return;
    }
    this.habitat.selection.set({ type: 'PLANT_SELECTED', plantId: result.object.id });
    this.npc.maybeSay('PLANT_CREATED');
  }

  /** Arrow keys / WASD move one tile. Ignored while typing in a field. */
  onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (el?.closest('input, textarea, select, [contenteditable], [role="tablist"], [role="menu"]')) return;
    const d = MOVE_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!d) return;
    e.preventDefault();
    this.garden.pickerTile.set(null);
    this.garden.closeupId.set(null);
    this.player.step(d[0], d[1]);
  }

  onDialogueAction(action: string): void {
    if (action === 'EXPLAIN') this.npc.say('EXPLAIN');
    else this.npc.dismiss();
  }

  async reset(): Promise<void> {
    await this.garden.resetDemo();
    this.player.reset();
    this.habitat.selection.set(null);
    this.habitat.openPanel.set(null);
    this.npc.say('GREETING');
  }

  private flash(msg: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(msg);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 2500);
  }
}
