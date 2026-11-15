import { Component, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CareAction, CareError, HabitatInteraction, PlacementError } from '@garden/shared';
import { GardenStore } from './garden/garden.store';
import { PlantPickerComponent } from './garden/components/plant-picker.component';
import { PlantCloseupComponent } from './garden/components/plant-closeup.component';
import { TileInfoComponent } from './garden/components/tile-info.component';
import { DialogueBubbleComponent } from './npc/dialogue-bubble.component';
import { NpcStore } from './npc/npc.store';
import { HealthStore } from './health/health.store';
import { HabitatStore } from './habitat/habitat.store';
import { PlayerStore } from './habitat/player.store';
import { NpcActorStore } from './npc/npc-actor.store';
import { CrewReminders } from './npc/crew-reminders';
import { HabitatCanvasComponent } from './habitat/habitat-canvas.component';
import { LayoutOverlayComponent } from './habitat/layout-overlay.component';
import { DoorLabelsComponent } from './habitat/door-labels.component';
import { HudComponent } from './habitat/hud.component';
import { TouchPadComponent } from './habitat/touch-pad.component';
import { ActionButtonComponent } from './habitat/action-button.component';
import { StationDialogComponent } from './habitat/panels/station-dialog.component';
import type { TileCoord } from './garden/game/tile-manager';

const CARE_ERRORS: Partial<Record<CareError | 'NOT_FOUND', string>> = {
  NO_FERTILIZER: 'Out of fertilizer. The Supply Store has more.',
  COOLDOWN: 'It needs a little rest first.',
  NOT_FOUND: 'That plant is gone.',
};

const GENTLE_ERRORS: Record<PlacementError, string> = {
  NO_SEEDS: 'No packets of that one. The Supply Store has more.',
  TILE_OCCUPIED: 'That needs a bit more room.',
  NOT_PLANTABLE: 'That needs a bit more soil.',
  OUT_OF_BOUNDS: "That's outside the garden.",
  UNKNOWN_ITEM: "Hmm, I don't recognise that seed.",
};

const MOVE_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};

@Component({
  selector: 'app-root',
  host: {
    '(document:keydown)': 'onKey($event, true)',
    '(document:keyup)': 'onKey($event, false)',
    '(window:blur)': 'player.releaseKeys()',
  },
  imports: [
    HabitatCanvasComponent,
    LayoutOverlayComponent,
    DoorLabelsComponent,
    HudComponent,
    TouchPadComponent,
    ActionButtonComponent,
    PlantPickerComponent,
    PlantCloseupComponent,
    TileInfoComponent,
    StationDialogComponent,
    DialogueBubbleComponent,
  ],
  template: `
    <div class="fixed inset-0 overflow-hidden" [style.padding]="safeArea">
      <!-- The room: as large as the screen allows, centred; leftover space becomes margins. -->
      <div class="grid size-full place-items-center" data-habitat-slot>
        <div #roomView class="relative">
          <app-habitat-canvas (interaction)="onInteraction($event)" />
          <app-door-labels />
          @if (habitat.showLayout()) { <app-layout-overlay /> }
          @if (garden.pickerTile(); as t) {
            <app-plant-picker [tile]="t" (picked)="plantAt(t, $event)" (closed)="garden.pickerTile.set(null)" />
          }
          @if (garden.closeup(); as c) {
            <app-plant-closeup [info]="c" (closed)="garden.closeupId.set(null)" (care)="onCare(c.object.id, $event)" />
          }
        </div>
      </div>

      <!-- Overlays pinned to the screen edges (in the margins when there are any). -->
      <app-hud class="absolute inset-x-2 top-2 z-30" (reset)="reset()" />
      <app-tile-info class="absolute left-2 top-14 z-20 max-w-[min(18rem,calc(100%-1rem))]" />
      @if (notice(); as n) {
        <div class="panel absolute left-1/2 top-14 z-30 -translate-x-1/2 px-3 py-1 text-sm font-bold" role="status">{{ n }}</div>
      }
      <app-action-button class="absolute bottom-4 left-4 z-20 [@media(max-height:420px)]:left-2" (act)="onAction()" />
      <app-touch-pad class="absolute bottom-3 right-3 z-20" />
      @if (!garden.closeup()) {
        <div class="bubble-slot pointer-events-none absolute z-20 [&>*]:pointer-events-auto">
          <app-dialogue-bubble (action)="onDialogueAction($event)" (answer)="crewReminders.answer($event)" />
        </div>
      }

      @if (habitat.openPanel(); as p) {
        <app-station-dialog [panel]="p" [anchor]="roomView" (closed)="habitat.openPanel.set(null)" />
      }

      <!-- Phones are played sideways; in portrait, ask to rotate instead of squeezing the room. -->
      <div class="rotate-hint absolute inset-0 z-50 flex-col items-center justify-center gap-3 bg-night p-6 text-center text-cream" role="alert">
        <span class="text-5xl" aria-hidden="true">📱↻</span>
        <p class="font-pixel text-2xl">Turn your phone sideways</p>
        <p class="max-w-xs text-sm text-cream/70">Jardín Comunal is made for landscape.</p>
      </div>
    </div>
  `,
  styles: `
    /* Only on touch phones held upright (not narrow desktop windows). */
    .rotate-hint { display: none; }
    @media (orientation: portrait) and (pointer: coarse) and (max-width: 600px) {
      .rotate-hint { display: flex; }
    }
    /* The speech bubble (Sprout's and the crew's): between the corner controls when there's room, above them when there isn't. */
    .bubble-slot { left: 0.5rem; right: 0.5rem; bottom: 10.5rem; }
    @media (min-width: 640px) {
      .bubble-slot { left: 50%; right: auto; bottom: 0.75rem; width: min(30rem, 100% - 21rem); translate: -50% 0; }
    }
    @media (max-height: 420px) and (min-width: 640px) {
      .bubble-slot { width: min(26rem, 100% - 19rem); }
    }
  `,
})
export class App {
  protected readonly garden = inject(GardenStore);
  protected readonly habitat = inject(HabitatStore);
  protected readonly npc = inject(NpcStore);
  protected readonly player = inject(PlayerStore);
  private readonly npcActors = inject(NpcActorStore);
  protected readonly crewReminders = inject(CrewReminders);
  private readonly health = inject(HealthStore);
  protected readonly notice = signal<string | null>(null);
  /** Keep clear of notches and home indicators on phones. */
  protected readonly safeArea =
    'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  private readonly canvas = viewChild.required(HabitatCanvasComponent);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Leaving a room closes whatever belonged to it.
    effect(() => {
      this.habitat.activeRoom();
      untracked(() => {
        this.habitat.selection.set(null);
        this.habitat.hover.set(null);
        this.habitat.openPanel.set(null);
        this.garden.pickerTile.set(null);
        this.garden.closeupId.set(null);
        this.npc.dismiss();
      });
    });
    this.health.init();
    this.garden.init().then(() => setTimeout(() => this.npc.say('GREETING'), 600));
  }

  /**
   * Every tap in the habitat lands here. Floor → just inspect. Anything else →
   * walk up to it, then act on it. The thing tapped is the thing acted on.
   */
  onInteraction(raw: HabitatInteraction): void {
    this.use(this.habitat.resolve(raw), true);
  }

  /** Action button / E / Space: use whatever is in reach, right where you stand. */
  onAction(): void {
    const target = this.habitat.reachable();
    if (target) this.use(target.interaction, false);
  }

  private use(i: HabitatInteraction, walkThere: boolean): void {
    const plot = this.garden.pickerTile();
    this.garden.pickerTile.set(null);
    this.garden.closeupId.set(null);
    this.habitat.selection.set(i.type === 'NPC_SELECTED' ? this.habitat.selection() : i);

    if (i.type === 'TILE_SELECTED') return; // floor taps only inspect; move with the pad or keys
    if (i.type === 'NPC_SELECTED') this.npcActors.hold(i.npcId); // stop wandering so you can catch up
    const rect = walkThere ? this.habitat.targetRect(i) : null;
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
      case 'STORE_SELECTED':
        this.habitat.openPanel.set(i.type);
        break;
      case 'NPC_SELECTED':
        if (i.npcId === 'SPROUT') this.npc.talk();
        else this.crewReminders.talk(i.npcId);
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

  /** Hold arrow keys / WASD to walk. Ignored while typing in a field. */
  onKey(e: KeyboardEvent, down: boolean): void {
    const el = e.target as HTMLElement | null;
    if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && down && !e.repeat) {
      // Let focused buttons and fields keep their own Space behaviour.
      if (el?.closest('input, textarea, select, button, [contenteditable], [role="menu"], dialog')) return;
      e.preventDefault();
      this.onAction();
      return;
    }
    const dir = MOVE_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!dir) return;
    if (down && el?.closest('input, textarea, select, [contenteditable], [role="tablist"], [role="menu"], dialog')) return;
    e.preventDefault();
    if (down) {
      this.garden.pickerTile.set(null);
      this.garden.closeupId.set(null);
    }
    this.player.setKey(dir, down);
  }

  async onCare(plantId: string, action: CareAction): Promise<void> {
    const result = await this.garden.care(plantId, action);
    if (!result.ok) {
      this.flash(CARE_ERRORS[result.error] ?? 'That didn\'t work. Try again.');
      return;
    }
    if (action === 'HARVEST') this.flash(result.earned ? `Harvested! 🌱 +${result.earned}` : 'Harvested! The plot is free again.');
    else if (result.earned) this.flash(`🌱 +${result.earned}`);
  }

  onDialogueAction(action: string): void {
    if (action === 'EXPLAIN') this.npc.say('EXPLAIN');
    else this.npc.dismiss();
  }

  async reset(): Promise<void> {
    await this.garden.resetDemo();
    await this.health.reset();
    this.player.reset();
    this.crewReminders.reset();
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
