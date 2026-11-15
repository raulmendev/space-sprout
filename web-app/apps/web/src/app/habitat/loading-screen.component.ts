import { Component, computed, input } from '@angular/core';

/**
 * Shown from page load until the room is on screen (the start menu sits above it).
 * index.html shows the same markup before Angular starts, so the hand-over doesn't jump:
 * change both together. The look is global (styles.css, "Loading screen") since
 * index.html needs it before Angular loads.
 * The station (assets/loading/station.webp) stands in for the animated logo, if that arrives.
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
      <div class="boot-station" aria-hidden="true">
        <img src="assets/loading/station.webp" alt="" width="384" height="157" />
        <span class="boot-shine"></span><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
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
