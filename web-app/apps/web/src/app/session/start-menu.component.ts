import { Component, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AssetService } from '../shared/assets.service';
import { suitPortraitKey } from '../garden/game/asset-registry';
import { DISPLAY_NAME_MAX, type Member, STATION_KEY_LENGTH, SUITS, type Suit, normalizeStationKey } from '@garden/shared';
import { CURRENT_USER, ROLE, SAVED_PROFILE, SUIT, saveProfile, switchTo } from './current-user';
import { type PlayerChoice, stationMembers } from './member-session';

const SUIT_LABELS: Record<Suit, string> = { turquoise: 'Turquoise', green: 'Green', black: 'Black', wine: 'Wine', purple: 'Purple', cactus: 'Cactus', leaf: 'Leaf' };

/**
 * The start menu: astronaut (suit carousel), name, astronaut or family, and station
 * key. Shown on the first visit (it can't be skipped then) and again from the HUD's
 * menu ("Change player", which can be cancelled). Starting saves the profile and
 * reloads, since who is playing is fixed for the page's lifetime.
 */
@Component({
  selector: 'app-start-menu',
  template: `
    <dialog
      #dialog
      aria-labelledby="start-title"
      [attr.closedby]="canCancel() ? 'any' : 'none'"
      (cancel)="onCancel($event)"
      (close)="closed.emit()"
    >
      <!-- Only the fields scroll when the screen is too short for them: Start always stays in view. -->
      <form class="panel relative flex min-h-0 max-h-full flex-col gap-4 p-5 short:gap-2 short:p-3 tiny:gap-1.5 tiny:p-2" novalidate (submit)="$event.preventDefault(); start()">
        <h1 id="start-title" class="sr-only">Jardín Comunal: who's coming aboard?</h1>
        @if (canCancel()) {
          <button type="button" class="soft-btn btn-press absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-lg text-xs" aria-label="Close" (click)="dialog.close()">✕</button>
        }

        <div class="fields grid min-h-0 flex-1 gap-4 overflow-y-auto min-[520px]:grid-cols-[auto_1fr] min-[520px]:gap-5 short:gap-3">
          <!-- Astronaut: one suit at a time, its neighbours peeking in at the sides. -->
          <section class="flex h-full flex-col items-center gap-2 short:gap-1" aria-roledescription="carousel" aria-labelledby="suit-title" (keydown.arrowleft)="step(-1)" (keydown.arrowright)="step(1)">
            <h2 id="suit-title" class="flex items-center gap-2 self-start font-pixel text-xl leading-tight short:text-lg tiny:text-base">
              <span class="grid size-8 place-items-center rounded-lg bg-steel-dark text-lg" aria-hidden="true">🧑‍🚀</span>Choose your astronaut
            </h2>
            <p class="sr-only" aria-live="polite">{{ label(suit()) }} suit</p>
            <div class="flex min-h-0 w-full flex-1 items-center gap-1">
              <button type="button" class="nav-btn btn-press z-20 shrink-0" aria-label="Previous suit" (click)="step(-1)">‹</button>
              <!-- The strip: every slot slides together; drag it sideways to browse. -->
              <div
                #stage
                class="stage relative h-full min-h-36 w-60 shrink-0 cursor-grab touch-pan-y select-none short:min-h-28 short:w-44 tiny:min-h-24 tiny:w-40"
                [class.cursor-grabbing]="dragging"
                (pointerdown)="dragStart($event)"
                (pointermove)="dragMove($event)"
                (pointerup)="dragEnd($event)"
                (pointercancel)="dragEnd($event)"
                (lostpointercapture)="dragEnd($event)"
              >
                @for (slot of slots(); track slot.at) {
                  @let p = slot.at + shift();
                  @let f = focusOf(p);
                  <div
                    class="slot"
                    [class.smooth]="smooth()"
                    [style.--p]="p"
                    [style.--f]="f"
                    [style.z-index]="slot.at === 0 ? 10 : 5 - (slot.at < 0 ? -slot.at : slot.at)"
                    aria-hidden="true"
                    (click)="slotClick(slot.at)"
                  >
                    @if (slot.at === 0) {
                      <span class="sparkle left-2 top-3">✦</span>
                      <span class="sparkle bottom-9 right-2">✦</span>
                    }
                    <!-- A skeleton until the real portrait has loaded (not the generic placeholder first). -->
                    @let src = assets.manifestLoaded() ? assets.url(portrait(slot.suit)) : null;
                    @let shown = !!src && shownPortraits().has(src);
                    @if (!shown) {
                      <span class="portrait-skeleton h-[68%] max-h-36"></span>
                    }
                    @if (src) {
                      <img [src]="src" alt="" draggable="false" class="pixelated h-[68%] max-h-36 w-auto" [class.hidden]="!shown" (load)="portraitShown(src)" (error)="portraitShown(src)" />
                    }
                    <span class="slot-name">{{ label(slot.suit) }} suit</span>
                  </div>
                }
              </div>
              <button type="button" class="nav-btn btn-press z-20 shrink-0" aria-label="Next suit" (click)="step(1)">›</button>
            </div>
            <div class="flex gap-2" role="group" aria-label="Suits">
              @for (s of suits; track s) {
                <button
                  type="button"
                  class="size-3.5 rounded-full border-2 border-bark"
                  [class]="s === suit() ? 'bg-leaf-dark !border-leaf-dark' : 'bg-transparent hover:bg-bark/20'"
                  [attr.aria-label]="label(s) + ' suit'"
                  [attr.aria-pressed]="s === suit()"
                  (click)="goTo(s)"
                ></button>
              }
            </div>
          </section>

          <div class="flex min-w-0 flex-col gap-3 border-bark/25 min-[520px]:border-l-2 min-[520px]:pl-5 tiny:min-[520px]:pl-3 short:gap-2 tiny:gap-1">
            <label class="flex flex-col gap-1">
              <span class="field-title"><span aria-hidden="true">👤</span>Your name</span>
              <input
                #nameInput
                autofocus
                name="name"
                class="field"
                autocomplete="nickname"
                placeholder="Type your name"
                aria-describedby="name-error"
                [attr.aria-invalid]="showNameError() || null"
                [attr.maxlength]="nameMax"
                [value]="name()"
                (input)="name.set($any($event.target).value)"
              />
              @if (showNameError()) {
                <span id="name-error" class="text-xs font-bold text-alert" role="alert">Enter a name to start.</span>
              }
            </label>

            <fieldset class="flex flex-col gap-1">
              <legend class="field-title mb-1"><span aria-hidden="true">👥</span>Who are you?</legend>
              <div class="grid grid-cols-2 gap-2">
                @for (r of roles; track r.value) {
                  @let on = role() === r.value;
                  <label class="role flex cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-sm font-extrabold short:py-1.5 tiny:py-1" [class.on]="on">
                    <input type="radio" name="role" class="sr-only" [value]="r.value" [checked]="on" (change)="role.set(r.value)" />
                    <span class="text-lg leading-none" aria-hidden="true">{{ r.icon }}</span>{{ r.label }}
                    @if (on) { <span class="tick" aria-hidden="true">✓</span> }
                  </label>
                }
              </div>
            </fieldset>

            <label class="flex flex-col gap-1">
              <span class="field-title"><span aria-hidden="true">🔑</span>Station key <span class="font-normal text-bark">(optional)</span></span>
              <input
                name="stationKey"
                class="field font-mono uppercase placeholder:font-sans placeholder:normal-case"
                autocomplete="off"
                spellcheck="false"
                placeholder="Blank starts a new station"
                aria-describedby="station-key-hint"
                [value]="stationKey()"
                (input)="stationKey.set($any($event.target).value)"
              />
              @if (!aboard() && !keyError()) {
                <span id="station-key-hint" class="flex items-center gap-1.5 text-xs text-bark">
                  <span class="grid size-4 shrink-0 place-items-center rounded-full bg-steel text-[0.65rem] font-black text-cream" aria-hidden="true">i</span>
                  Got a key from family? Type it to join their station.
                </span>
              } @else if (keyError()) {
                <span id="station-key-hint" class="text-xs font-bold text-alert" role="alert">{{ keyError() }}</span>
              }
            </label>
            <!-- Someone already in this station, on a new device: tap yourself instead of joining again. -->
            @if (aboard(); as a) {
              <div class="flex flex-col gap-1 short:gap-0.5" role="group" aria-labelledby="aboard-title">
                <span id="aboard-title" class="text-xs font-bold text-bark">Already aboard? Tap yourself:</span>
                <ul class="flex gap-1.5 overflow-x-auto pb-1 short:pb-0.5">
                  @for (m of a.members; track m.id) {
                    <li class="shrink-0">
                      <button
                        type="button"
                        class="soft-btn btn-press flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-sm font-extrabold"
                        [disabled]="busy()"
                        [attr.aria-label]="(m.id === me ? 'Keep playing as ' : 'Play as ') + m.displayName"
                        (click)="pick(a.key, m)"
                      >
                        <span class="grid size-6 place-items-center rounded-full text-sm" [style.background]="m.color" aria-hidden="true">{{ m.role === 'ASTRONAUT' ? '🧑‍🚀' : '🏡' }}</span>
                        {{ m.displayName }}@if (m.id === me) {<span class="font-normal text-bark">&nbsp;(you)</span>}
                      </button>
                    </li>
                  }
                </ul>
              </div>
            } @else if (lookingUp()) {
              <div class="flex flex-col gap-1 short:gap-0.5" role="status">
                <span class="text-xs font-bold text-bark">Looking up the station…</span>
                <div class="flex gap-1.5 pb-1 short:pb-0.5" aria-hidden="true">
                  @for (w of [5.5, 7, 4.5]; track $index) {
                    <span class="chip-skeleton" [style.width.rem]="w"></span>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        @if (error()) {
          <p class="text-center text-sm font-bold text-alert" role="alert">{{ error() }}</p>
        }
        <button type="submit" class="chunky-btn btn-press start-btn shrink-0" [disabled]="busy()" [attr.aria-busy]="busy()">
          @if (busy()) { Boarding… } @else { 🚀 Start <span aria-hidden="true">›</span> }
        </button>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      background: transparent;
      width: min(40rem, 100vw - 1rem);
      max-height: calc(100dvh - 1rem);
      overflow: hidden;
    }
    /* Centred on the screen (the CSS reset zeroes a dialog's auto margins). */
    dialog:modal { display: flex; flex-direction: column; margin: auto; }
    dialog::backdrop { background: rgb(29 27 58 / 0.8); }

    .field-title { display: flex; align-items: center; gap: 0.4rem; font-weight: 800; font-size: 0.95rem; }
    .field {
      border: 2px solid color-mix(in srgb, var(--color-bark) 60%, transparent);
      border-radius: 10px;
      background: white;
      padding: 0.4rem 0.65rem;
      font-size: 1rem;
    }
    .field::placeholder { color: color-mix(in srgb, var(--color-bark) 80%, transparent); }
    .field:focus { outline: none; border-color: var(--color-steel); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-steel) 30%, transparent); }
    .field[aria-invalid='true'] { border-color: var(--color-alert); }

    /*
     * Role buttons: raised parchment tiles. The chosen one sits pressed in, with a soft
     * leaf tint, a leaf outline and a small check badge on its corner.
     */
    .role {
      position: relative;
      border: 2px solid color-mix(in srgb, var(--color-bark) 35%, transparent);
      border-radius: 10px;
      background: var(--color-parchment);
      color: color-mix(in srgb, var(--color-bark-dark) 80%, transparent);
      box-shadow: 0 3px 0 color-mix(in srgb, var(--color-bark) 35%, transparent);
      transition: background-color 120ms, border-color 120ms, box-shadow 120ms, translate 120ms;
    }
    .role:hover { border-color: color-mix(in srgb, var(--color-bark) 60%, transparent); }
    .role.on {
      border-color: var(--color-leaf-dark);
      background: color-mix(in srgb, var(--color-leaf) 18%, var(--color-cream));
      color: var(--color-bark-dark);
      box-shadow: inset 0 2px 0 color-mix(in srgb, var(--color-leaf-dark) 18%, transparent);
      translate: 0 2px;
    }
    .role:has(:focus-visible) { outline: 2px solid color-mix(in srgb, var(--color-steel) 60%, transparent); outline-offset: 2px; }
    .tick {
      position: absolute;
      top: -0.45rem;
      right: -0.45rem;
      display: grid;
      place-items: center;
      width: 1.15rem;
      height: 1.15rem;
      border-radius: 999px;
      background: var(--color-leaf-dark);
      color: var(--color-cream);
      font-size: 0.65rem;
      font-weight: 900;
      box-shadow: 0 0 0 2px var(--color-cream);
    }
    @media (prefers-reduced-motion: reduce) { .role { transition: none; } }

    /* Carousel: the chosen suit on a sunny card, the next ones faded behind it. */
    .nav-btn {
      --press: var(--color-bark-dark);
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      background: var(--color-parchment);
      font-size: 1.6rem;
      font-weight: 900;
      line-height: 1;
      color: var(--color-bark-dark);
    }
    .nav-btn:hover { background: var(--color-sun); }
    /*
     * Each slot sits at --p card-steps from the centre (fractional while dragging or
     * sliding). --f is 1 at the centre and 0 one step away: it grows the card, lights
     * it up in sun yellow and fades the side ones.
     */
    .stage {
      --card: 8rem;
      --step: 5.4rem;
      overflow: hidden;
      mask-image: linear-gradient(90deg, transparent, black 14%, black 86%, transparent);
    }
    @media (max-height: 500px) { .stage { --card: 6.5rem; --step: 4.6rem; } }
    .slot {
      position: absolute;
      top: 50%;
      left: calc(50% + var(--p) * var(--step));
      width: var(--card);
      height: 96%;
      translate: -50% -50%;
      scale: calc(0.68 + 0.32 * var(--f));
      opacity: calc(0.45 + 0.55 * var(--f));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      border-radius: 16px;
      border: 3px solid color-mix(in srgb, var(--color-sun) calc(var(--f) * 100%), transparent);
      background:
        radial-gradient(circle at 50% 40%, color-mix(in srgb, #fff7d6 calc(var(--f) * 100%), transparent), transparent 70%),
        color-mix(in srgb, color-mix(in srgb, var(--color-sun) 55%, var(--color-cream)) calc(var(--f) * 100%), var(--color-parchment));
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--color-sun) calc(var(--f) * 35%), transparent),
        0 4px 0 color-mix(in srgb, var(--color-bark) calc(var(--f) * 40%), transparent);
    }
    .slot.smooth {
      transition: left 260ms cubic-bezier(0.2, 0.8, 0.3, 1.15), scale 260ms ease-out, opacity 260ms ease-out, background 260ms, border-color 260ms;
    }
    .slot-name { font-size: 0.8rem; font-weight: 800; opacity: var(--f); white-space: nowrap; }
    .sparkle { position: absolute; color: var(--color-sun); font-size: 0.9rem; text-shadow: 0 0 2px var(--color-bark); opacity: var(--f); }
    @media (prefers-reduced-motion: reduce) { .slot.smooth { transition: none; } }

    /* Loading stand-ins: an astronaut silhouette (helmet over body) and member chips, shimmering. */
    .portrait-skeleton, .chip-skeleton {
      background: linear-gradient(100deg, var(--color-parchment) 35%, #fff8e8 50%, var(--color-parchment) 65%) 100% 0 / 250% 100%;
      animation: skeleton 1.4s ease-in-out infinite;
    }
    .portrait-skeleton {
      aspect-ratio: 36 / 50;
      filter: brightness(0.88);
      /* A big round helmet, a narrower suit, two boots. */
      mask:
        radial-gradient(closest-side, #000 96%, transparent) 50% 0 / 84% 60% no-repeat,
        radial-gradient(closest-side, #000 96%, transparent) 50% 82% / 66% 42% no-repeat,
        linear-gradient(#000 0 0) 28% 100% / 20% 17% no-repeat,
        linear-gradient(#000 0 0) 72% 100% / 20% 17% no-repeat;
    }
    .chip-skeleton { display: block; height: 1.75rem; border-radius: 999px; border: 2px solid var(--color-parchment); background-color: var(--color-cream); }
    @keyframes skeleton { to { background-position: 0 0; } }
    /* The global rule only shortens animations; a looping one would flicker. */
    @media (prefers-reduced-motion: reduce) { .portrait-skeleton, .chip-skeleton { animation: none; } }

    .start-btn { font-family: var(--font-pixel); font-size: 1.5rem; padding-block: 0.6rem; }
    @media (max-height: 500px) { .start-btn { font-size: 1.25rem; padding-block: 0.35rem; } }

    /* The scrolling fields keep room for focus rings and the role check badge. */
    .fields { padding: 0.45rem 0.45rem 0.25rem; margin: -0.45rem -0.45rem -0.25rem; scrollbar-width: thin; }

    /*
     * Very short screens (16:9 phones, a large system font size, the keyboard up):
     * smaller card, tighter fields, so the whole menu still fits without scrolling.
     */
    @media (max-height: 380px) {
      .stage { --card: 5.6rem; --step: 4rem; }
      .field { padding-block: 0.2rem; font-size: 0.95rem; }
      .field-title { font-size: 0.85rem; }
      .start-btn { font-size: 1.1rem; padding-block: 0.2rem; }
    }
  `,
})
export class StartMenuComponent {
  /** False on the first visit: the player has to choose before playing. */
  readonly canCancel = input(false);
  readonly closed = output<void>();
  protected readonly assets = inject(AssetService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly suits = SUITS;
  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly roles = [
    { value: 'ASTRONAUT', label: 'Astronaut', icon: '🧑‍🚀' },
    { value: 'FAMILY', label: 'Family', icon: '🏡' },
  ] as const;

  // Start from what this page is playing as, so "Change player" only changes what you touch.
  protected readonly name = signal(SAVED_PROFILE?.role === ROLE ? SAVED_PROFILE.name : '');
  protected readonly role = signal<PlayerChoice['role']>(ROLE);
  protected readonly suit = signal<Suit>(SUIT);
  protected readonly stationKey = signal(SAVED_PROFILE?.stationKey ?? '');
  /** Waiting for the station to answer Start. */
  protected readonly busy = signal(false);
  /** Why Start didn't go through (an unknown key, no connection). */
  protected readonly error = signal('');
  /** Who's in the station the typed key names (once it's a whole key). */
  protected readonly aboard = signal<{ key: string; members: Member[] } | null>(null);
  /** Why the typed key found nobody (unknown key, no connection). */
  protected readonly keyError = signal('');
  /** Who this page is playing as, marked "(you)" in the list. */
  protected readonly me = SAVED_PROFILE ? CURRENT_USER.id : null;
  /** A whole key was typed and the station hasn't answered yet. */
  protected readonly lookingUp = signal(false);
  private lookups = 0;
  /** Portrait URLs that have finished loading; until then their slot shows a skeleton. */
  protected readonly shownPortraits = signal<ReadonlySet<string>>(new Set());
  /** Set once Start is pressed without a name; cleared as soon as one is typed. */
  private readonly triedStart = signal(false);
  protected readonly showNameError = computed(() => this.triedStart() && !this.name().trim());

  // ---- carousel
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  /** The strip shows the chosen suit and two either side (wrapping round). */
  protected readonly slots = computed(() => [-2, -1, 0, 1, 2].map((at) => ({ at, suit: this.neighbour(at) })));
  /** How far the strip is pushed off centre, in card steps (drag, or the start of a slide). */
  protected readonly shift = signal(0);
  /** Off while dragging (the strip follows the finger), on to glide back into place. */
  protected readonly smooth = signal(true);
  protected dragging = false;
  private drag: { x: number; t: number; px: number; moved: boolean } | null = null;

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    effect(() => void this.lookUp(normalizeStationKey(this.stationKey())));
  }

  /** Looks up who's in the station once a whole key is typed; only the latest answer counts. */
  private async lookUp(key: string): Promise<void> {
    const n = ++this.lookups;
    this.aboard.set(null);
    this.keyError.set('');
    this.lookingUp.set(key.length === STATION_KEY_LENGTH);
    if (key.length !== STATION_KEY_LENGTH) return;
    try {
      const members = await stationMembers(key);
      if (n === this.lookups) this.aboard.set({ key, members });
    } catch (e) {
      if (n === this.lookups) this.keyError.set((e as Error).message);
    } finally {
      if (n === this.lookups) this.lookingUp.set(false);
    }
  }

  protected portraitShown(src: string): void {
    this.shownPortraits.update((s) => (s.has(src) ? s : new Set(s).add(src)));
  }

  /** "That's me": play as someone already in the station (yourself: just carry on). */
  protected async pick(key: string, m: Member): Promise<void> {
    if (m.id === this.me) return this.dialog().nativeElement.close();
    this.busy.set(true);
    this.error.set('');
    try {
      await switchTo(key, m.id);
    } catch (e) {
      this.error.set((e as Error).message);
      this.busy.set(false);
    }
  }

  protected focusOf(p: number): number {
    return Math.max(0, 1 - Math.abs(p));
  }

  /** Move to the suit `by` steps away, sliding from where the strip is now (`from`, in steps). */
  protected step(by: number, from = 0): void {
    if (!by) return this.glideTo(from);
    this.suit.set(this.neighbour(by));
    this.glideTo(from + by);
  }

  /** Slide to a suit from the dots, the short way round. */
  protected goTo(s: Suit): void {
    const n = SUITS.length;
    let by = (SUITS.indexOf(s) - SUITS.indexOf(this.suit()) + n) % n;
    if (by > n / 2) by -= n;
    this.step(by);
  }

  /** Jump the strip to `from` without animating, then let it glide to the centre. */
  private glideTo(from: number): void {
    this.smooth.set(false);
    this.shift.set(from);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.smooth.set(true);
        this.shift.set(0);
      }),
    );
  }

  /** Width of one card step in pixels (from the CSS, so it follows the short-screen size). */
  private stepPx(): number {
    const el = this.stage().nativeElement;
    const probe = document.createElement('div');
    probe.style.width = 'var(--step)';
    el.appendChild(probe);
    const px = probe.getBoundingClientRect().width || 86;
    probe.remove();
    return px;
  }

  protected dragStart(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.suppressClick = false;
    this.drag ={ x: e.clientX, t: e.timeStamp, px: this.stepPx(), moved: false };
    this.dragging = true;
    this.smooth.set(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  protected dragMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 4) this.drag.moved = true;
    // Follows the finger up to one step, then only a little further (rubbery).
    const steps = dx / this.drag.px;
    const over = Math.max(0, Math.abs(steps) - 1);
    this.shift.set(Math.sign(steps) * (Math.min(Math.abs(steps), 1) + over * 0.25));
  }

  protected dragEnd(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.dragging = false;
    const s = this.shift();
    const flick = Math.abs(s) > 0.08 && Math.abs(s) * d.px / Math.max(1, e.timeStamp - d.t) > 0.5;
    // Past a third of a step, or a quick flick: move one suit that way. Otherwise settle back.
    const by = Math.abs(s) > 0.33 || flick ? -Math.sign(s) : 0;
    this.step(by, s);
    if (d.moved) this.suppressClick = true;
  }

  /** A drag ends with a click on whatever was under the finger: ignore that one. */
  private suppressClick = false;

  protected slotClick(at: number): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (at) this.step(at);
  }

  private neighbour(by: number): Suit {
    const i = SUITS.indexOf(this.suit());
    return SUITS[(((i + by) % SUITS.length) + SUITS.length) % SUITS.length];
  }

  protected portrait(s: Suit): string {
    return suitPortraitKey(s);
  }

  protected label(s: Suit): string {
    return SUIT_LABELS[s];
  }

  /** Esc only closes when there is a game to go back to. */
  protected onCancel(e: Event): void {
    if (!this.canCancel()) e.preventDefault();
  }

  protected async start(): Promise<void> {
    const name = this.name().trim();
    if (!name) {
      this.triedStart.set(true);
      this.nameInput().nativeElement.focus();
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await saveProfile({ name, role: this.role(), suit: this.suit(), stationKey: this.stationKey() });
    } catch (e) {
      this.error.set((e as Error).message);
      this.busy.set(false);
    }
  }
}
