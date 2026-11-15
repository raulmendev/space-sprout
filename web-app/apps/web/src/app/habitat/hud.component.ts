import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { EmoteId, ROOMS, RoomId } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from './habitat.store';
import { PlayerStore } from './player.store';
import { EmoteWheelComponent } from './emote-wheel.component';
import { CURRENT_USER, IS_FAMILY } from '../session/current-user';
import { stationKey } from '../session/member-session';

/**
 * Slim overlay along the top of the screen: rooms, seeds, fullscreen and a small
 * menu. Replaces the old page header so the room can use the whole screen.
 */
@Component({
  selector: 'app-hud',
  imports: [EmoteWheelComponent],
  host: {
    class: 'pointer-events-none flex items-start justify-between gap-2 [&>*]:pointer-events-auto',
    '(document:fullscreenchange)': 'syncFullscreen()',
    '(document:keydown.escape)': 'closeMenu()',
    '(document:pointerdown)': 'closeMenuIfOutside($event)',
  },
  template: `
    <nav aria-label="Rooms" class="rounded-full bg-night/60 p-1 backdrop-blur-sm">
      <ol class="flex items-center gap-0.5 text-xs font-bold sm:text-sm">
        @for (r of roomOrder; track r; let last = $last) {
          @let here = habitat.activeRoom() === r;
          <li
            class="rounded-full px-2.5 py-1"
            [class]="here ? 'bg-cream text-bark-dark' : 'hidden text-cream/60 sm:block'"
            [attr.aria-current]="here ? 'location' : null"
          >{{ rooms[r].name }}</li>
          @if (!last) { <li aria-hidden="true" class="hidden text-cream/40 sm:block">↔</li> }
        }
      </ol>
    </nav>

    <div class="flex items-center gap-3">
      <div class="relative">
        <span
          class="flex h-12 items-center gap-1 rounded-full bg-night/60 px-2.5 text-sm font-bold text-cream backdrop-blur-sm"
          [attr.aria-label]="'Playing as ' + me.displayName"
          [title]="'Playing as ' + me.displayName"
        ><span class="text-lg" aria-hidden="true">{{ meIcon }}</span><span class="hidden md:inline">{{ me.displayName }}</span></span>
        <!-- Hangs below the name, out of the row's layout, so it never pushes the buttons off a small screen. -->
        @if (garden.reconnecting()) {
          <span class="absolute left-1/2 top-full mt-1.5 flex h-7 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-night/75 px-3 text-xs font-bold text-cream backdrop-blur-sm" role="status">
            <span class="size-2 animate-pulse rounded-full bg-sun" aria-hidden="true"></span>Reconnecting…
          </span>
        }
      </div>
      <span class="panel flex h-12 items-center whitespace-nowrap px-3 text-xl font-extrabold text-bark-dark" aria-label="Seeds balance">🌱 {{ garden.balance() }}</span>
      <button
        #emoteButton
        type="button"
        class="grid size-12 place-items-center rounded-full bg-night/60 text-[1.75rem] leading-none backdrop-blur-sm hover:bg-night/80 focus-visible:outline-2 focus-visible:outline-sun"
        aria-label="Emotes"
        aria-haspopup="dialog"
        [attr.aria-expanded]="popover() === 'emotes'"
        (click)="toggle('emotes')"
      >😊</button>
      @if (popover() === 'emotes') {
        <app-emote-wheel (picked)="sendEmote($event)" (closed)="closeEmotes()" />
      }
      <button
        type="button"
        class="grid size-12 place-items-center rounded-full bg-night/60 text-[2rem] leading-none backdrop-blur-sm hover:bg-night/80 focus-visible:outline-2 focus-visible:outline-sun"
        aria-label="Inventory"
        (click)="habitat.openPanel.set('INVENTORY')"
      >🎒</button>
      @if (canFullscreen) {
        <button
          type="button"
          class="grid size-12 place-items-center rounded-full bg-night/60 text-[2.25rem] font-black leading-none text-cream backdrop-blur-sm hover:bg-night/80 focus-visible:outline-2 focus-visible:outline-sun"
          [attr.aria-label]="isFullscreen() ? 'Exit full screen' : 'Full screen'"
          (click)="toggleFullscreen()"
        >{{ isFullscreen() ? '⤡' : '⤢' }}</button>
      }
      <div class="relative">
        <button
          type="button"
          class="grid size-12 place-items-center rounded-full bg-night/60 text-[2.25rem] font-black leading-none text-cream backdrop-blur-sm hover:bg-night/80 focus-visible:outline-2 focus-visible:outline-sun"
          aria-label="Menu"
          [attr.aria-expanded]="popover() === 'menu'"
          aria-controls="hud-menu"
          (click)="toggle('menu')"
        >⋯</button>
        @if (popover() === 'menu') {
          <div id="hud-menu" class="panel absolute right-0 top-14 z-40 flex w-48 flex-col gap-1 p-2 text-sm">
            <p class="px-2 pt-1 font-pixel text-base">Space Sprout</p>
            <label class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-parchment">
              <input type="checkbox" class="accent-leaf-dark" [checked]="habitat.showLayout()" (change)="habitat.showLayout.set(!habitat.showLayout())" />
              Show layout
            </label>
            @if (stationKey) {
              <p class="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5" title="Give this key to family so they can join your station">
                Station key <span class="select-all font-mono font-extrabold tracking-wider">{{ stationKey }}</span>
              </p>
            }
            <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-parchment" (click)="popover.set(null); changePlayer.emit()">Change player</button>
            @if (garden.canReset) {
              <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-parchment" (click)="popover.set(null); reset.emit()">Reset demo</button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class HudComponent {
  protected readonly habitat = inject(HabitatStore);
  protected readonly garden = inject(GardenStore);
  readonly reset = output<void>();

  /** Rooms west → east, as connected by their doors. */
  protected readonly roomOrder: RoomId[] = ['GARDEN', 'SOCIAL', 'MEDICAL'];
  protected readonly rooms = ROOMS;
  private readonly player = inject(PlayerStore);
  /** What's open from the HUD: the menu or the emote wheel (one tap sends an emote and closes it). One at a time. */
  protected readonly popover = signal<'menu' | 'emotes' | null>(null);
  private readonly emoteButton = viewChild.required<ElementRef<HTMLButtonElement>>('emoteButton');
  /** Opens the start menu again (name, astronaut or family, suit). */
  readonly changePlayer = output<void>();
  /** Who is playing (start menu profile, or the URL). */
  protected readonly me = CURRENT_USER;
  protected readonly meIcon = IS_FAMILY ? '🏡' : '🧑‍🚀';
  /** This station's key, to give to family (none when playing from the dev shortcut). */
  protected readonly stationKey = stationKey();
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly isFullscreen = signal(false);
  /** iPhone Safari has no element fullscreen; there, "Add to Home Screen" gives full screen instead. */
  protected readonly canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  constructor() {
    // A station popup opening (or a room change) puts the menu away.
    effect(() => {
      this.habitat.openPanel();
      this.habitat.activeRoom();
      this.popover.set(null);
    });
  }

  protected toggle(which: 'menu' | 'emotes'): void {
    this.popover.set(this.popover() === which ? null : which);
  }

  /** The menu closes on Escape, or a tap anywhere outside the HUD (the wheel handles both itself). */
  protected closeMenu(): void {
    if (this.popover() === 'menu') this.popover.set(null);
  }

  protected closeMenuIfOutside(e: PointerEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.closeMenu();
  }

  protected sendEmote(id: EmoteId): void {
    this.closeEmotes();
    this.player.sendEmote(id);
  }

  /** Close the wheel and give focus back to its button. */
  protected closeEmotes(): void {
    this.popover.set(null);
    this.emoteButton().nativeElement.focus();
  }

  protected syncFullscreen(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  protected async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) return void (await document.exitFullscreen());
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Phones play best sideways; ignore where locking isn't allowed.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape').catch(() => {});
  }
}
