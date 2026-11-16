import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { failureText } from '../garden/failure-text';
import { NgTemplateOutlet } from '@angular/common';
import { NOTE_RULES, POST_IT, owned, type SocialNote } from '@garden/shared';
import { NotesStore } from './notes.store';
import { GardenStore } from '../garden/garden.store';
import { HabitatStore } from '../habitat/habitat.store';
import { timeAgo } from '../health/format';
import { t } from '../i18n/i18n';

/** How long "Tap again to take it down" stays armed (same as harvesting a plant). */
const CONFIRM_MS = 4000;

/**
 * The board up close: a cork "screen" inside the station console, every note pinned as a
 * post-it in two rows (newest first; scrolling sideways only past what fits), and a tray to
 * write one. Post-its show the start of a note; tapping one opens it full size.
 * Writing uses a post-it from the household inventory; when there are none, the main button
 * takes you to the Supply Store's Messages tab.
 * Opening it marks notes as read.
 */
@Component({
  selector: 'app-message-board-panel',
  imports: [NgTemplateOutlet],
  template: `
    <!-- Decorative stickers on the cork. -->
    <span class="sticker photo" aria-hidden="true">🌍</span>
    <span class="sticker star" aria-hidden="true">⭐</span>
    <span class="sticker rocket" aria-hidden="true">🚀</span>

    <p class="info">
      <span class="info-icon" aria-hidden="true">i</span>
      {{ t('Notes between orbit and home, up to {max} characters each. Draft: they stay in this browser until syncing arrives.', { max }) }}
    </p>

    @if (notes.newestFirst().length) {
      <ul class="notes" [attr.aria-label]="t('Notes, newest first')">
        @for (note of notes.newestFirst(); track note.id; let i = $index) {
          <li [style.rotate.deg]="tilt[i % tilt.length]">
            <button type="button" class="note" [id]="'note-' + note.id" [style.background]="color(note)" (click)="reading.set(note)">
              <ng-container [ngTemplateOutlet]="noteBody" [ngTemplateOutletContext]="{ $implicit: note }" />
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ t('No notes yet. Write the first one!') }}</p>
    }

    @if (reading(); as note) {
      <!-- One note, full size, over the cork. -->
      <div class="reader">
        <article class="note open" [style.background]="color(note)" [attr.aria-label]="t('Note')">
          <ng-container [ngTemplateOutlet]="noteBody" [ngTemplateOutletContext]="{ $implicit: note }" />
        </article>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button #readerClose type="button" class="cancel soft-btn btn-press" (click)="closeReader()">{{ t('Back to the board') }}</button>
          @if (notes.canTakeDown(note)) {
            <button type="button" class="take-down btn-press" [class.confirm]="confirmTakeDown()" (click)="takeDown(note)">
              {{ confirmTakeDown() ? t('Tap again to take it down') : t('🗑️ Take down') }}
            </button>
          } @else {
            <span class="text-xs font-bold text-cream">{{ t('Only the {name} can take this note down.', { name: author(note).toLowerCase(), who: author(note) }) }}</span>
          }
        </div>
      </div>
    }

    <!-- What's written on a post-it, on the board and full size. -->
    <ng-template #noteBody let-note>
      <span class="pin" aria-hidden="true"></span>
      <span class="text">{{ note.content }}</span>
      <span class="flex items-end justify-between gap-1">
        <span class="meta">{{ author(note) }} · {{ ago(note.createdAt) }}</span>
        <span class="avatar" aria-hidden="true">{{ notes.fromAstronaut(note) ? '🧑‍🚀' : '🏡' }}</span>
      </span>
    </ng-template>

    <form class="tray" (submit)="$event.preventDefault(); pin()">
      @if (writing()) {
        <label for="note-text" class="sr-only">{{ t('Your note') }}</label>
        <textarea
          #noteText
          id="note-text"
          rows="2"
          [attr.maxlength]="max"
          [placeholder]="t('Write something for home…')"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
        ></textarea>
        <div class="flex gap-2">
          <button type="button" class="cancel soft-btn btn-press" (click)="cancel()">{{ t('Cancel') }}</button>
          <button type="submit" class="chunky-btn btn-press" [disabled]="!draft().trim() || busy()">{{ t('📌 Pin note') }}</button>
        </div>
      } @else if (postIts()) {
        <button type="button" class="chunky-btn btn-press write" (click)="writing.set(true)">{{ t('✏️ Write a note') }}</button>
      } @else {
        <!-- Out of post-its: the button takes you to where they are (walks over, opens the store's Messages tab). -->
        <button type="button" class="chunky-btn btn-press write" (click)="habitat.visit('STORE_SELECTED', 'MESSAGES')">{{ t('🛒 Get post-its at the Supply Store') }}</button>
      }
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bark/75">
        <span class="font-bold text-bark-dark">📝 {{ postItsLabel() }}</span>
        <span role="status" class="min-w-0" [class.out]="!postIts()">{{ status() }}</span>
        <span class="ml-auto tabular-nums" [class.font-bold]="draft().length > max - 20">{{ draft().length }} / {{ max }}</span>
      </div>
    </form>
  `,
  host: {
    class: 'console-screen relative flex min-h-0 flex-1 flex-col gap-3 short:gap-2',
    '[class.writing]': 'writing()',
    '(keydown.escape)': 'onEscape($event)',
  },
  styles: `
    /* A cork screen (frame from .console-screen). */
    :host {
      --shade: color-mix(in srgb, var(--color-bark-dark) 25%, transparent);
      padding: 14px 16px 12px;
      background:
        radial-gradient(circle, color-mix(in srgb, var(--color-bark-dark) 18%, transparent) 0.8px, transparent 1.2px) 0 0 / 7px 7px,
        radial-gradient(circle, rgb(255 255 255 / 0.16) 0.8px, transparent 1.2px) 3px 4px / 9px 9px,
        #c99158;
    }

    .sticker {
      position: absolute;
      z-index: 1;
      pointer-events: none;
      line-height: 1;
      filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 1px rgb(0 0 0 / 0.3));
    }
    .photo { top: -10px; left: -8px; font-size: 1.8rem; rotate: -10deg; }
    .star { top: -8px; right: -6px; font-size: 1.5rem; rotate: 12deg; }
    .rocket { bottom: 64px; right: -8px; font-size: 1.6rem; rotate: -15deg; }
    :host(.writing) .rocket { display: none; }

    .info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-inline: 1.5rem;
      padding: 0.35rem 0.75rem;
      border: 2px solid var(--shade);
      border-radius: 8px;
      background: var(--color-cream);
      font-size: 0.85rem;
    }
    .info-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 1.3rem;
      height: 1.3rem;
      border: 2px solid var(--color-steel-dark);
      border-radius: 50%;
      font: 800 0.75rem/1 var(--font-sans);
      color: var(--color-steel-dark);
    }

    /*
     * Two rows of post-its, filled column by column, newest first: about 8 fit on a laptop and
     * 6 on a phone. Past that the board scrolls sideways, so the panel never grows taller.
     */
    .notes {
      --note-w: 10.5rem;
      /* Takes the popup's spare height (and gives it back while writing). */
      flex: 1;
      min-height: 0;
      align-content: center;
      display: grid;
      grid-template-rows: repeat(2, auto);
      grid-auto-flow: column;
      grid-auto-columns: var(--note-w);
      justify-content: safe center;
      gap: 16px 12px;
      padding: 12px 6px 8px;
      overflow: auto;
      scroll-snap-type: x proximity;
      overscroll-behavior-x: contain;
    }
    .notes li { display: grid; scroll-snap-align: start; }
    .note {
      position: relative;
      display: flex;
      min-height: 6.25rem;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.85rem 0.65rem 0.4rem;
      border: 2px solid var(--color-bark-dark);
      border-radius: 3px 3px 12px 3px; /* curled corner */
      box-shadow: 0 3px 0 rgb(0 0 0 / 0.18);
      text-align: left;
      font-size: 0.85rem;
    }
    button.note:hover { filter: brightness(1.04); }
    button.note:focus-visible, .reader button:focus-visible { outline: 2px solid var(--color-steel); outline-offset: 2px; }
    .text {
      flex: 1;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
      font-weight: 600;
      line-height: 1.3;
    }
    .meta { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 0.7rem; font-weight: 700; color: color-mix(in srgb, var(--color-bark-dark) 75%, transparent); }
    .avatar { font-size: 1.15rem; line-height: 1; }
    .pin {
      position: absolute;
      top: -9px;
      left: calc(50% - 8px);
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-bark-dark);
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ff9a92 0 2px, var(--color-alert) 3px);
      box-shadow: 0 2px 0 rgb(0 0 0 / 0.25);
    }
    .empty {
      display: grid;
      place-items: center;
      min-height: 7rem;
      margin-inline: 1.5rem;
      border: 2px dashed color-mix(in srgb, var(--color-bark-dark) 40%, transparent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--color-cream) 60%, transparent);
      font-weight: 700;
    }

    .reader {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 7px;
      background: color-mix(in srgb, var(--color-bark-dark) 55%, transparent);
      overflow: auto;
    }
    .note.open { width: min(26rem, 100%); min-height: 0; padding: 1.2rem 1rem 0.6rem; font-size: 1rem; gap: 0.6rem; rotate: -1deg; }
    .note.open .text { display: block; white-space: pre-line; }
    .note.open .meta { font-size: 0.8rem; }
    .note.open .avatar { font-size: 1.6rem; }
    .take-down { --press: var(--color-bark-dark); padding: 0.4rem 1rem; background: var(--color-cream); color: var(--color-alert); font-weight: 800; }
    .take-down.confirm { --press: #7a1f1a; background: var(--color-alert); color: #fff; }

    /* The tray along the bottom: write button on a steel rail, then a cream footer strip. */
    .tray {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0 -16px -12px;
      padding: 10px 16px 8px;
      border-top: 3px solid var(--color-steel-dark);
      border-radius: 0 0 7px 7px;
      background: var(--color-cream);
    }
    .write { max-width: 20rem; margin: -26px auto 0; }
    textarea {
      width: 100%;
      resize: none;
      padding: 0.4rem 0.6rem;
      border: 2px solid color-mix(in srgb, var(--color-bark-dark) 35%, transparent);
      border-radius: 8px;
      background: #fff;
      font-weight: 600;
    }
    textarea:focus-visible { outline: 2px solid var(--color-steel); outline-offset: 1px; }
    .cancel { padding: 0.4rem 1rem; }
    .out { color: var(--color-alert); font-weight: 800; }

    /* Same breakpoint as the short: variant in styles.css: fit landscape phones. */
    @media (max-height: 500px) {
      :host { padding: 8px 12px 8px; }
      .info { display: none; }
      /* While writing, the text box takes the notes' place (the phone keyboard covers most of the screen anyway). */
      :host(.writing) .notes, :host(.writing) .empty { display: none; }
      .notes { --note-w: 9rem; gap: 12px 10px; padding-block: 10px 4px; }
      .note { min-height: 0; padding: 0.7rem 0.55rem 0.3rem; font-size: 0.75rem; gap: 0.2rem; }
      .text { -webkit-line-clamp: 2; }
      .avatar { font-size: 0.95rem; }
      .reader { padding: 0.5rem; gap: 0.5rem; }
      .note.open { font-size: 0.9rem; padding: 1rem 0.9rem 0.4rem; }
      .tray { margin: 0 -12px -8px; padding: 8px 12px 6px; gap: 0.35rem; }
      .write { margin-top: -22px; }
      .photo, .star { font-size: 1.3rem; }
      .rocket { display: none; }
    }

    /* Keyboard up (shared/keyboard.ts): just the text box and its buttons, above the keyboard. */
    :host-context(.keyboard-open) { padding: 4px 8px; gap: 0; }
    :host-context(.keyboard-open) :is(.info, .notes, .empty, .sticker) { display: none; }
    :host-context(.keyboard-open) .tray { flex: 1; min-height: 0; margin: 0 -8px -4px; padding: 6px 8px 4px; gap: 0.3rem; border-top: 0; }
    :host-context(.keyboard-open) textarea { flex: 1; min-height: 2.4rem; }
    :host-context(.keyboard-open) .tray button { padding-block: 0.2rem; }
  `,
})
export class MessageBoardPanelComponent {
  protected readonly notes = inject(NotesStore);
  protected readonly garden = inject(GardenStore);
  protected readonly habitat = inject(HabitatStore);
  private readonly injector = inject(Injector);
  protected readonly t = t;
  protected readonly max = NOTE_RULES.maxLength;
  protected readonly ago = timeAgo;
  /** Post-its in the household inventory. */
  protected readonly postIts = computed(() => owned(this.garden.inventory(), POST_IT));
  protected readonly postItsLabel = computed(() => (this.postIts() === 1 ? t('1 post-it') : t('{n} post-its', { n: this.postIts() })));
  protected readonly tilt = [-1.5, 1, 1.5, -1, -0.5, 1.5, 1, -1.5];

  protected readonly writing = signal(false);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  /** The note opened full size, if any. */
  protected readonly reading = signal<SocialNote | null>(null);
  /** First tap on "Take down" arms it for a few seconds; the second removes the note. */
  protected readonly confirmTakeDown = signal(false);
  private confirmTimer?: ReturnType<typeof setTimeout>;

  /** The latest result, worded when shown (so it follows a language change). */
  private readonly message = signal<() => string>(() => '');
  /** Out of post-its: say where to get more. Otherwise the latest result. */
  protected readonly status = computed(() => (this.postIts() ? this.message()() : t('Out of post-its. The Supply Store, in this room, has more.')));

  private readonly noteText = viewChild<ElementRef<HTMLTextAreaElement>>('noteText');
  private readonly readerClose = viewChild<ElementRef<HTMLButtonElement>>('readerClose');

  constructor() {
    this.notes.markAllRead();
    // Focus the text box, or the full-size note's first button, as soon as it appears.
    effect(() => this.noteText()?.nativeElement.focus());
    effect(() => this.readerClose()?.nativeElement.focus());
  }

  protected author(note: SocialNote): string {
    return this.notes.author(note);
  }

  protected color(note: SocialNote): string {
    return this.notes.color(note);
  }

  /** Esc closes the full-size note, then the text box, before it closes the board itself. */
  protected onEscape(e: Event): void {
    if (this.reading()) this.closeReader();
    else if (this.writing()) this.cancel();
    else return;
    e.preventDefault(); // keep the <dialog> open
    e.stopPropagation(); // and the station panel's own Esc handler out of it
  }

  protected async pin(): Promise<void> {
    if (!this.draft().trim() || this.busy()) return;
    this.busy.set(true);
    const failed = await this.notes.post(this.draft());
    this.busy.set(false);
    if (failed) {
      this.message.set(() => failureText({ OUT_OF_POST_ITS: t('You need a post-it to pin this note.'), EMPTY_NOTE: t('Write something first.') }, failed));
      return;
    }
    const left = this.postIts();
    this.message.set(() => (left === 1 ? t('Pinned! 1 post-it left.') : t('Pinned! {n} post-its left.', { n: left })));
    this.cancel();
  }

  protected cancel(): void {
    this.draft.set('');
    this.writing.set(false);
  }

  /** Close the full-size note and put focus back on its post-it (or the board, if it's gone). */
  protected closeReader(): void {
    const id = this.reading()?.id;
    this.reading.set(null);
    this.disarm();
    // After the board re-renders, so a note that was just taken down is already gone.
    afterNextRender(
      () => (document.getElementById('note-' + id) ?? document.querySelector<HTMLElement>('button.note, .tray button'))?.focus(),
      { injector: this.injector },
    );
  }

  protected async takeDown(note: SocialNote): Promise<void> {
    if (!this.confirmTakeDown()) {
      this.confirmTakeDown.set(true);
      this.confirmTimer = setTimeout(() => this.confirmTakeDown.set(false), CONFIRM_MS);
      return;
    }
    const failed = await this.notes.takeDown(note);
    this.message.set(() => (failed ? failureText({ NOT_YOURS: t('Only whoever pinned it can take it down.') }, failed) : t('Note taken down.')));
    this.closeReader();
  }

  private disarm(): void {
    clearTimeout(this.confirmTimer);
    this.confirmTakeDown.set(false);
  }
}
