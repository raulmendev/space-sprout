import { Component, inject, signal, viewChild } from '@angular/core';
import { PlacementError } from '@garden/shared';
import { GardenStore } from './garden/garden.store';
import { GardenCanvasComponent } from './garden/components/garden-canvas.component';
import { PlantPickerComponent } from './garden/components/plant-picker.component';
import { PlantCloseupComponent } from './garden/components/plant-closeup.component';
import { TileInfoComponent } from './garden/components/tile-info.component';
import { DialogueBubbleComponent } from './npc/dialogue-bubble.component';
import { NpcStore } from './npc/npc.store';
import type { TileCoord } from './garden/game/tile-manager';

const GENTLE_ERRORS: Record<PlacementError, string> = {
  INSUFFICIENT_FUNDS: 'Not quite enough seeds for that one yet.',
  TILE_OCCUPIED: "Something's already growing there.",
  NOT_PLANTABLE: 'Seeds like the soil plots best.',
  OUT_OF_BOUNDS: "That's outside the garden.",
  UNKNOWN_ITEM: "Hmm, I don't recognise that seed.",
};

@Component({
  selector: 'app-root',
  imports: [GardenCanvasComponent, PlantPickerComponent, PlantCloseupComponent, TileInfoComponent, DialogueBubbleComponent],
  template: `
    <div class="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4">
      <header class="flex flex-wrap items-center justify-between gap-3 text-cream">
        <div>
          <h1 class="font-pixel text-3xl leading-none">Jardín Comunal</h1>
          <p class="text-sm text-cream/70">A little garden shared between orbit and home.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="panel px-3 py-1 text-lg font-extrabold text-bark-dark" aria-label="Seeds balance">🌱 {{ store.balance() }}</span>
          <button type="button" class="rounded-md px-2 py-1 text-xs text-cream/60 hover:text-cream" (click)="reset()">reset demo</button>
        </div>
      </header>

      <main class="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="relative mx-auto w-full max-w-[min(100%,calc(100vh-10rem))]">
          <div class="rounded-xl border-4 border-bark-dark bg-bark p-1.5 shadow-[0_8px_0_rgb(0_0_0/0.3)]">
            <div class="relative">
              <app-garden-canvas (tileClicked)="onTile($event)" (npcClicked)="npc.talk()" />
              @if (store.pickerTile(); as t) {
                <app-plant-picker [tile]="t" (picked)="plantAt(t, $event)" (closed)="store.pickerTile.set(null)" />
              }
              @if (store.closeup(); as c) {
                <app-plant-closeup [info]="c" (closed)="store.closeupId.set(null)" />
              }
            </div>
          </div>
          @if (!store.closeup()) {
            <div class="pointer-events-none absolute inset-x-3 bottom-3 [&>*]:pointer-events-auto">
              <app-dialogue-bubble (action)="onDialogueAction($event)" />
            </div>
          }
          @if (notice(); as n) {
            <div class="panel absolute left-1/2 top-3 -translate-x-1/2 px-3 py-1 text-sm font-bold" role="status">{{ n }}</div>
          }
        </div>

        <aside class="flex flex-col gap-4">
          <app-tile-info />
        </aside>
      </main>
    </div>
  `,
})
export class App {
  protected readonly store = inject(GardenStore);
  protected readonly npc = inject(NpcStore);
  protected readonly notice = signal<string | null>(null);
  private readonly canvas = viewChild.required(GardenCanvasComponent);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.store.init().then(() => setTimeout(() => this.npc.say('GREETING'), 600));
  }

  /** Click the thing you want to act on: empty plot opens the picker, anything else shows info. */
  onTile(tile: TileCoord): void {
    const open = this.store.pickerTile();
    const sameTile = open?.x === tile.x && open?.y === tile.y;
    this.store.selectTile(tile);
    const plant = this.store.objects().find((o) => o.x === tile.x && o.y === tile.y);
    this.store.closeupId.set(plant?.id ?? null);
    this.store.pickerTile.set(!sameTile && this.store.isEmptyPlot(tile) ? tile : null);
  }

  async plantAt(tile: TileCoord, item: string): Promise<void> {
    this.store.pickerTile.set(null);
    const result = await this.store.plant(item, tile);
    if (!result.ok) {
      this.canvas().shakeTile(tile);
      this.flash(GENTLE_ERRORS[result.error]);
      return;
    }
    this.npc.maybeSay('PLANT_CREATED');
  }

  onDialogueAction(action: string): void {
    switch (action) {
      case 'EXPLAIN':
        this.npc.say('EXPLAIN');
        break;
      default:
        this.npc.dismiss();
    }
  }

  async reset(): Promise<void> {
    await this.store.resetDemo();
    this.npc.say('GREETING');
  }

  private flash(msg: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(msg);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 2500);
  }
}
