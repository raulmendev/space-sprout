import { Component, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CareAction, CareError, DecorError, HabitatInteraction, LabelError, PlacementError, PotError, describeItem, isPet } from '@garden/shared';
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
import { DecorStore, DecorOutcome } from './decor/decor.store';
import { DecorBarComponent } from './decor/decor-bar.component';
import { StartMenuComponent } from './session/start-menu.component';
import { LoadingScreenComponent } from './habitat/loading-screen.component';
import { TitleScreenComponent } from './session/title-screen.component';
import { NEEDS_PROFILE } from './session/current-user';
import { OFFLINE_MESSAGE } from './session/member-session';
import { failureText } from './garden/failure-text';

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

const DECOR_ERRORS: Record<DecorError, string> = {
  TILE_OCCUPIED: "Something's already there.",
  WRONG_SURFACE: "That doesn't go there.",
  WRONG_ROOM: 'Decorations go in the Social Space.',
  OUT_OF_BOUNDS: "That's outside the room.",
  NONE_OWNED: 'None of those left in the inventory.',
  NOT_WATERABLE: "That one doesn't need water.",
  NOT_DECOR: "That isn't a decoration.",
  NOT_FOUND: 'That decoration is gone.',
};

const POT_ERRORS: Record<PotError, string> = {
  NO_POT: 'You need a clay pot. The Supply Store has them.',
  NOT_MATURE: 'Let it finish growing first.',
  NOT_FOUND: 'That plant is gone.',
};

const LABEL_ERRORS: Record<LabelError, string> = {
  OUT_OF_LABELS: 'You need a plant label. The Supply Store has them.',
  NOT_FOUND: 'That plant is gone.',
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
    TitleScreenComponent,
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
    DecorBarComponent,
    StartMenuComponent,
    LoadingScreenComponent,
  ],
  template: `
    <div class="fixed inset-0 overflow-hidden" [style.padding]="safeArea">
      <!-- The room: as large as the screen allows, centred; leftover space becomes margins. -->
      <div class="grid size-full place-items-center" data-habitat-slot>
        <div #roomView class="relative">
          <app-habitat-canvas (interaction)="onInteraction($event)" (progress)="loadProgress.set($event)" (ready)="loaded.set(true)" />
          <app-door-labels />
          @if (habitat.showLayout()) { <app-layout-overlay /> }
          @if (garden.pickerTile(); as t) {
            <app-plant-picker [tile]="t" (picked)="plantAt(t, $event)" (closed)="garden.pickerTile.set(null)" />
          }
          @if (garden.closeup(); as c) {
            <app-plant-closeup [info]="c" (closed)="garden.closeupId.set(null)" (care)="onCare(c.object.id, $event)" (pot)="onPot(c.object.id)" (label)="onLabel(c.object.id, $event)" />
          }
        </div>
      </div>

      <!-- Overlays pinned to the screen edges (in the margins when there are any). -->
      <!-- While placing a decoration the top bar steps aside: on phones it covers the back wall. -->
      <app-hud class="absolute inset-x-2 top-2 z-30 transition-opacity" [class.stepped-aside]="!!decor.mode()" [inert]="!!decor.mode()" (reset)="reset()" (changePlayer)="startMenu.set('change')" />
      <!-- The picker already says what this plot is for; don't let the card cover it. -->
      @if (!garden.pickerTile()) {
        <app-tile-info class="absolute left-2 top-14 z-20 max-w-[min(18rem,calc(100%-1rem))]" />
      }
      @if (notice(); as n) {
        <div class="panel absolute left-1/2 top-14 z-30 -translate-x-1/2 px-3 py-1 text-sm font-bold" role="status">{{ n }}</div>
      }
      <app-action-button class="absolute bottom-4 right-4 z-20 [@media(max-height:420px)]:right-2" (act)="onAction()" />
      <app-touch-pad class="absolute bottom-3 left-8 z-20 [@media(max-height:420px)]:left-6" />
      @if (decor.active()) {
        <!-- Kept clear of the spot being decorated: below the top bar, or down between the corner controls. -->
        <div class="absolute z-30" [class]="decor.barAtTop() ? 'decor-top' : 'bubble-slot'">
          <app-decor-bar (done)="onDecorDone($event)" />
        </div>
      } @else if (!garden.closeup()) {
        <div class="bubble-slot pointer-events-none absolute z-20 [&>*]:pointer-events-auto">
          <app-dialogue-bubble
            (action)="onDialogueAction($event)"
            (answer)="crewReminders.answer($event)"
            (unknown)="crewReminders.answerUnknown($event.speaker, $event.metric)"
            (scan)="crewReminders.scan($event)"
            (later)="crewReminders.later($event)"
          />
        </div>
      }

      @if (habitat.openPanel(); as p) {
        <app-station-dialog [panel]="p" [anchor]="roomView" (closed)="habitat.openPanel.set(null)" />
      }

      @if (!loaded()) {
        <app-loading-screen [progress]="loadProgress()" animate.leave="loading-out" />
      }

      @if (title()) {
        <app-title-screen animate.leave="loading-out" (play)="leaveTitle(null)" (changePlayer)="leaveTitle('change')" />
      }

      @if (startMenu(); as m) {
        <app-start-menu [canCancel]="m === 'change'" (closed)="startMenu.set(null)" />
      }

      <!-- Phones are played sideways; in portrait, ask to rotate instead of squeezing the room. -->
      <div class="rotate-hint absolute inset-0 z-50 flex-col items-center justify-center gap-3 bg-night p-6 text-center text-cream" role="alert">
        <span class="text-5xl" aria-hidden="true">📱↻</span>
        <p class="font-pixel text-2xl">Turn your phone sideways</p>
        <p class="max-w-xs text-sm text-cream/70">Space Sprout is made for landscape.</p>
      </div>
    </div>
  `,
  styles: `
    /* Only on touch phones held upright (not narrow desktop windows). */
    .rotate-hint { display: none; }
    @media (orientation: portrait) and (pointer: coarse) and (max-width: 600px) {
      .rotate-hint { display: flex; }
    }
    /* The speech bubble (Rabanito's, the pets' and the crew's): between the corner controls when there's room, above them when there isn't. */
    .bubble-slot { left: 0.5rem; right: 0.5rem; bottom: 10.5rem; }
    .stepped-aside { opacity: 0; pointer-events: none; }
    .decor-top { top: 3.5rem; left: 50%; width: min(30rem, 100% - 1rem); translate: -50% 0; }
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
  protected readonly decor = inject(DecorStore);
  private readonly health = inject(HealthStore);
  protected readonly notice = signal<string | null>(null);
  /** The start menu: on the first visit (must choose), or reopened from the HUD menu (can cancel). */
  /** The loading screen shows until the room is on screen. */
  protected readonly loadProgress = signal(0);
  protected readonly loaded = signal(false);
  /** The title screen, on every visit; Play leaves it (for the start menu, on a first visit). */
  protected readonly title = signal(true);
  protected readonly startMenu = signal<'first' | 'change' | null>(null);
  /** Keep clear of notches and home indicators on phones. */
  protected readonly safeArea =
    'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  private readonly canvas = viewChild.required(HabitatCanvasComponent);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Someone else in the station did something: say so ("Mom watered the mustard.").
    effect(() => {
      const news = this.garden.news();
      if (news) untracked(() => this.flash(news.text));
    });
    // Leaving a room closes whatever belonged to it.
    effect(() => {
      this.habitat.activeRoom();
      untracked(() => {
        this.habitat.selection.set(null);
        this.habitat.hover.set(null);
        this.habitat.openPanel.set(null);
        this.garden.pickerTile.set(null);
        this.garden.closeupId.set(null);
        this.decor.clear();
        this.npc.dismiss();
      });
    });
    // Someone starts talking to you (Rabanito, a pet or the crew): the astronaut waves hello.
    let talking = false;
    effect(() => {
      const now = !!this.npc.current();
      if (now && !talking) untracked(() => this.player.wave());
      talking = now;
    });
    this.health.init();
    this.garden.init().then(
      () => setTimeout(() => this.npc.say('GREETING'), 600),
      () => this.flash(OFFLINE_MESSAGE), // the garden fills in once the station answers (coming back to the tab retries)
    );
  }

  /**
   * Every tap in the habitat lands here. Floor → just inspect. Anything else →
   * walk up to it, then act on it. The thing tapped is the thing acted on.
   */
  onInteraction(raw: HabitatInteraction): void {
    // Placing a decoration: every tap picks a spot (the scene reports plain tiles meanwhile).
    if (this.decor.mode()) {
      if (raw.type === 'TILE_SELECTED' && !this.decor.pick(raw)) this.canvas().flashTile(raw);
      return;
    }
    const i = this.habitat.resolve(raw);
    this.decor.clear();
    if (i.type === 'DECOR_SELECTED') {
      // Rearranging is household admin, not a walk-up action: the menu opens where you stand.
      this.garden.pickerTile.set(null);
      this.garden.closeupId.set(null);
      this.decor.select(i.decorId);
      return;
    }
    this.use(i, true);
  }

  /** Off the title screen: into the game, through the start menu when nobody's playing yet (or to change player). */
  protected leaveTitle(menu: 'change' | null): void {
    this.title.set(false);
    this.startMenu.set(NEEDS_PROFILE ? 'first' : menu);
  }

  /** Action button / E / Space: use whatever is in reach, right where you stand. */
  onAction(): void {
    if (this.decor.active()) return;
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
      case 'STORE_SELECTED':
        this.habitat.openPanel.set(i.type);
        break;
      case 'NPC_SELECTED':
        if (i.npcId === 'RADISH') this.npc.talk(); // Rabanito is the garden guide
        else if (isPet(i.npcId)) this.npc.petSays(i.npcId);
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
      this.flash(failureText(GENTLE_ERRORS, result.error));
      return;
    }
    this.habitat.selection.set({ type: 'PLANT_SELECTED', plantId: result.object.id });
    this.npc.maybeSay('PLANT_CREATED');
  }

  /** "Pot it" from a plant's close-up: say where the potted plant went. */
  async onPot(plantId: string): Promise<void> {
    const result = await this.garden.potPlant(plantId);
    if (!result.ok) {
      this.flash(failureText(POT_ERRORS, result.error));
      return;
    }
    this.flash(`${describeItem(result.itemId).name} is in the 🎒 inventory.`);
  }

  /** A plant named, renamed or its label taken off, from its close-up (`text` comes tidied: see labelText). */
  async onLabel(plantId: string, text: string): Promise<void> {
    const result = await this.garden.labelPlant(plantId, text);
    if (!result.ok) {
      this.flash(failureText(LABEL_ERRORS, result.error));
      return;
    }
    this.flash(text ? `🏷️ “${text}”` : 'The label is off.');
  }

  /** Place / move / water / put away finished: say how it went. */
  onDecorDone(outcome: DecorOutcome): void {
    this.flash(outcome.ok ? outcome.message : failureText(DECOR_ERRORS, outcome.error));
  }

  /** Hold arrow keys / WASD to walk. Ignored while typing in a field. */
  onKey(e: KeyboardEvent, down: boolean): void {
    if (this.title()) return; // the title screen's own buttons take the keys
    const el = e.target as HTMLElement | null;
    if (e.key === 'Escape' && down && this.decor.active() && !el?.closest('dialog')) {
      this.decor.clear();
      return;
    }
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
      this.flash(failureText(CARE_ERRORS, result.error));
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
    this.decor.clear();
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
