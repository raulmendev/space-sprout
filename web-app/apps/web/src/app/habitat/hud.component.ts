import { Component, ElementRef, effect, inject, output, signal } from '@angular/core';
import { ROOMS, RoomId } from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from './habitat.store';
import { CURRENT_USER, IS_FAMILY } from '../session/current-user';

/**
 * Slim overlay along the top of the screen: rooms, seeds, fullscreen and a small
 * menu. Replaces the old page header so the room can use the whole screen.
 */
@Component({
  selector: 'app-hud',
  host: {
    class: 'pointer-events-none flex items-start justify-between gap-2 [&>*]:pointer-events-auto',
    '(document:fullscreenchange)': 'syncFullscreen()',
    '(document:keydown.escape)': 'menuOpen.set(false)',
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
      <span
        class="flex h-12 items-center gap-1 rounded-full bg-night/60 px-2.5 text-sm font-bold text-cream backdrop-blur-sm"
        [attr.aria-label]="'Playing as ' + me.displayName"
        [title]="'Playing as ' + me.displayName"
      ><span class="text-lg" aria-hidden="true">{{ meIcon }}</span><span class="hidden sm:inline">{{ me.displayName }}</span></span>
      <span class="panel flex h-12 items-center px-3 text-xl font-extrabold text-bark-dark" aria-label="Seeds balance">🌱 {{ garden.balance() }}</span>
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
          [attr.aria-expanded]="menuOpen()"
          aria-controls="hud-menu"
          (click)="menuOpen.set(!menuOpen())"
        >⋯</button>
        @if (menuOpen()) {
          <div id="hud-menu" class="panel absolute right-0 top-14 z-40 flex w-48 flex-col gap-1 p-2 text-sm">
            <p class="px-2 pt-1 font-pixel text-base">Jardín Comunal</p>
            <label class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-parchment">
              <input type="checkbox" class="accent-leaf-dark" [checked]="habitat.showLayout()" (change)="habitat.showLayout.set(!habitat.showLayout())" />
              Show layout
            </label>
            <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-parchment" (click)="menuOpen.set(false); changePlayer.emit()">Change player</button>
            <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-parchment" (click)="menuOpen.set(false); reset.emit()">Reset demo</button>
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
  protected readonly menuOpen = signal(false);
  /** Opens the start menu again (name, astronaut or family, suit). */
  readonly changePlayer = output<void>();
  /** Who is playing (start menu profile, or the URL). */
  protected readonly me = CURRENT_USER;
  protected readonly meIcon = IS_FAMILY ? '🏡' : '🧑‍🚀';
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly isFullscreen = signal(false);
  /** iPhone Safari has no element fullscreen; there, "Add to Home Screen" gives full screen instead. */
  protected readonly canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  constructor() {
    // A station popup opening (or a room change) puts the menu away.
    effect(() => {
      this.habitat.openPanel();
      this.habitat.activeRoom();
      this.menuOpen.set(false);
    });
  }

  /** Tapping anywhere outside the HUD closes the menu. */
  protected closeMenuIfOutside(e: PointerEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(e.target as Node)) this.menuOpen.set(false);
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
