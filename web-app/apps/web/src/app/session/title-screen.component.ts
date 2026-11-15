import { Component, afterNextRender, ElementRef, output, viewChild } from '@angular/core';
import { SAVED_PROFILE } from './current-user';

/**
 * The title screen: the Space Sprout logo over the loading screen's sky, shown on every visit.
 * Play goes into the game (a first visit goes on to the start menu); a returning player
 * also gets "Change player". The game keeps loading underneath, so Play is usually instant.
 */
@Component({
  selector: 'app-title-screen',
  host: { class: 'boot title-screen' },
  template: `
    <div class="boot-stars" aria-hidden="true"></div>
    <div class="boot-earth" aria-hidden="true"></div>
    <main class="title-body">
      <h1 class="title-logo-wrap">
        <img class="title-logo" src="assets/brand/space-sprout-logo.webp" alt="Space Sprout" width="640" height="654" />
      </h1>
      <div class="title-actions">
        <p class="title-tagline">A garden in orbit, grown together with family back home.</p>
        <button #playBtn type="button" class="chunky-btn btn-press title-play" (click)="play.emit()">
          <span aria-hidden="true">▶</span> Play
        </button>
        @if (who) {
          <p class="title-who">Playing as <strong>{{ who }}</strong></p>
          <button type="button" class="soft-btn btn-press title-change" (click)="changePlayer.emit()">Change player</button>
        }
      </div>
    </main>
  `,
  styles: `
    :host { z-index: 45; } /* above the loading screen; the start menu is a modal, above both */
    .title-body {
      position: relative;
      z-index: 1; /* in front of the shooting stars */
      display: flex;
      align-items: center;
      justify-content: center;
      gap: clamp(1.5rem, 6vw, 4rem);
      width: 100%;
      padding: 1rem 1.5rem 12vh;
    }
    .title-logo-wrap { flex-shrink: 0; }
    .title-logo {
      display: block;
      width: auto;
      height: min(68vh, 26rem, 52vw);
      filter: drop-shadow(0 6px 0 rgb(0 0 0 / 0.3));
      animation: boot-drift 6s ease-in-out infinite;
    }
    .title-actions { display: flex; flex-direction: column; align-items: stretch; gap: 0.75rem; width: min(17rem, 40vw); }
    .title-tagline { font-family: var(--font-pixel); font-size: 1rem; line-height: 1.3; text-align: center; opacity: 0.9; }
    .title-play { font-family: var(--font-pixel); font-size: 1.6rem; padding: 0.6rem 1rem; color: var(--color-bark-dark); }
    .title-who { text-align: center; font-size: 0.85rem; opacity: 0.85; }
    .title-change { padding: 0.4rem 0.75rem; font-size: 0.9rem; }

    /* Phones in portrait (or very narrow windows): stack. */
    @media (max-aspect-ratio: 1/1) {
      .title-body { flex-direction: column; gap: 1rem; padding-bottom: 14vh; }
      .title-logo { height: min(44vh, 70vw); }
      .title-actions { width: min(17rem, 80vw); }
    }
    /* Landscape phones: smaller type so everything clears the Earth along the bottom. */
    @media (max-height: 500px) {
      .title-body { padding-bottom: 14vh; }
      .title-actions { gap: 0.5rem; }
      .title-tagline { font-size: 0.85rem; }
      .title-play { font-size: 1.3rem; padding: 0.45rem 1rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .title-logo { animation: none; }
    }
  `,
})
export class TitleScreenComponent {
  readonly play = output<void>();
  readonly changePlayer = output<void>();
  /** The returning player's name; null on a first visit. */
  protected readonly who = SAVED_PROFILE?.name ?? null;
  private readonly playBtn = viewChild.required<ElementRef<HTMLButtonElement>>('playBtn');

  constructor() {
    // Enter or Space plays straight away.
    afterNextRender(() => this.playBtn().nativeElement.focus());
  }
}
