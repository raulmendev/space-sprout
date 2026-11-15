import { Component, computed, input } from '@angular/core';

/**
 * Shown from page load until the room is on screen (the start menu sits above it).
 * index.html shows the same markup before Angular starts, so the hand-over doesn't jump:
 * change both together. The look is global (styles.css, "Loading screen") since
 * index.html needs it before Angular loads.
 * PLACEHOLDER: the ISS (assets/loading/iss.svg) stands in for the animated logo.
 */
@Component({
  selector: 'app-loading-screen',
  host: {
    class: 'boot',
    role: 'status',
    '[attr.aria-label]': '"Loading the station, " + percent() + "%"',
  },
  template: `
    <div class="boot-stars" aria-hidden="true"></div>
    <div class="boot-earth" aria-hidden="true"></div>
    <div class="boot-body">
      <img class="boot-iss" src="assets/loading/iss.svg" alt="" width="384" height="176" />
      <p class="boot-title">Jardín Comunal</p>
      <div class="boot-bar" [class.waiting]="!percent()" aria-hidden="true">
        <div class="boot-fill" [style.width.%]="percent() || null"></div>
      </div>
      <p class="boot-text">Docking at the station…@if (percent()) { {{ percent() }}% }</p>
    </div>
  `,
})
export class LoadingScreenComponent {
  /** Share loaded so far, 0–1. */
  readonly progress = input(0);
  protected readonly percent = computed(() => Math.round(this.progress() * 100));
}
