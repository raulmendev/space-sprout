import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { ALL_PROPS, ROOMS } from '@garden/shared';
import type { HabitatPanel } from '../habitat.store';
import { MedicalTerminalPanelComponent } from '../../health/medical-terminal-panel.component';
import { HealthInsightsPanelComponent } from '../../health/health-insights-panel.component';

const EMOTES = [
  { glyph: '❤️', label: 'Love' },
  { glyph: '😊', label: 'Happy' },
  { glyph: '👋', label: 'Hello' },
  { glyph: '🌱', label: 'Encouragement' },
  { glyph: '⭐', label: 'Celebration' },
  { glyph: '🫂', label: 'Hug' },
];

/**
 * Panels opened from habitat objects. Medical panels are live; the social ones
 * are still shells until notes and emotes are built.
 */
@Component({
  selector: 'app-station-panel',
  imports: [MedicalTerminalPanelComponent, HealthInsightsPanelComponent],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <section class="panel flex flex-col gap-3 p-4" role="region" [attr.aria-labelledby]="'panel-title'">
      <header class="flex items-start justify-between gap-2">
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-bark/70">{{ meta().zone }}</p>
          <h2 id="panel-title" #heading tabindex="-1" class="font-pixel text-2xl leading-tight outline-none">{{ meta().title }}</h2>
        </div>
        <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-parchment focus-visible:outline-2 focus-visible:outline-sun" aria-label="Close panel" (click)="closed.emit()">✕</button>
      </header>

      @switch (panel()) {
        @case ('MEDICAL_TERMINAL_SELECTED') {
          <app-medical-terminal-panel />
          <p class="rounded-md bg-parchment/70 p-2 text-xs">🔒 Private to you. Family members never see health data.</p>
        }
        @case ('HEALTH_INSIGHTS_SELECTED') {
          <app-health-insights-panel />
          <p class="rounded-md bg-parchment/70 p-2 text-xs">🔒 Private to you.</p>
        }
        @case ('MESSAGE_BOARD_SELECTED') {
          <p class="text-sm">Notes between orbit and home. Up to 280 characters, delivered whenever each side is online.</p>
          <div class="grid h-24 place-items-center rounded-md border-2 border-dashed border-bark/30 text-sm text-bark/70">No notes yet</div>
        }
        @case ('EMOTE_AREA_SELECTED') {
          <ul class="grid grid-cols-3 gap-2">
            @for (e of emotes; track e.label) {
              <li><button type="button" disabled class="flex w-full flex-col items-center rounded-lg bg-parchment/70 p-2 text-sm"><span class="text-2xl" aria-hidden="true">{{ e.glyph }}</span>{{ e.label }}</button></li>
            }
          </ul>
        }
      }
      @if (panel() === 'MESSAGE_BOARD_SELECTED' || panel() === 'EMOTE_AREA_SELECTED') {
        <p class="text-xs italic text-bark/60">Panel shell: notes and emotes arrive in a later step.</p>
      }
    </section>
  `,
})
export class StationPanelComponent {
  readonly panel = input.required<HabitatPanel>();
  readonly closed = output<void>();
  protected readonly emotes = EMOTES;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Title and zone come from the habitat data for the prop that opens this panel. */
  protected readonly meta = computed(() => {
    const prop = ALL_PROPS.find((p) => p.interaction === this.panel())!;
    return { title: prop.name, zone: ROOMS[prop.room].name };
  });

  constructor() {
    // Move focus into the panel whenever a different panel opens (keyboard users).
    effect(() => {
      this.panel();
      queueMicrotask(() => this.heading().nativeElement.focus());
    });
  }
}
