import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { HABITAT_PROPS, ZONES } from '@garden/shared';
import type { HabitatPanel } from '../habitat.store';

const EMOTES = [
  { glyph: '❤️', label: 'Love' },
  { glyph: '😊', label: 'Happy' },
  { glyph: '👋', label: 'Hello' },
  { glyph: '🌱', label: 'Encouragement' },
  { glyph: '⭐', label: 'Celebration' },
  { glyph: '🫂', label: 'Hug' },
];

/**
 * Panel shells opened from habitat objects. Structure only for the layout
 * checkpoint: data, persistence and sync arrive in the next build step.
 */
@Component({
  selector: 'app-station-panel',
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
          <div role="tablist" aria-label="Measurement source" class="flex gap-1 rounded-lg bg-parchment p-1 text-sm font-bold">
            @for (t of tabs; track t.id) {
              <button type="button" role="tab" class="flex-1 rounded-md px-2 py-1" [class.bg-cream]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
            }
          </div>
          @if (tab() === 'sync') {
            <p class="text-sm">Wearable: <b>Simulated device</b> · not synced yet</p>
          } @else {
            <p class="text-sm">Manual entry for heart rate, sleep, activity and mood.</p>
          }
          <p class="rounded-md bg-parchment/70 p-2 text-xs">🔒 Private to you. Family members never see health data.</p>
        }
        @case ('HEALTH_INSIGHTS_SELECTED') {
          <div class="grid h-28 place-items-center rounded-md border-2 border-dashed border-bark/30 text-sm text-bark/70">Trend chart</div>
          <p class="text-xs">Shows latest value, unit, time, source and trend. No diagnoses.</p>
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
      <p class="text-xs italic text-bark/60">Panel shell: working data arrives in the next build step.</p>
    </section>
  `,
})
export class StationPanelComponent {
  readonly panel = input.required<HabitatPanel>();
  readonly closed = output<void>();
  protected readonly emotes = EMOTES;
  protected readonly tabs = [
    { id: 'sync', label: 'Wearable sync' },
    { id: 'manual', label: 'Enter manually' },
  ] as const;
  protected readonly tab = signal<'sync' | 'manual'>('sync');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Title and zone come from the habitat data for the prop that opens this panel. */
  protected readonly meta = computed(() => {
    const prop = HABITAT_PROPS.find((p) => p.interaction === this.panel())!;
    return { title: prop.name, zone: ZONES[prop.zone].label };
  });

  constructor() {
    // Move focus into the panel whenever a different panel opens (keyboard users).
    effect(() => {
      this.panel();
      queueMicrotask(() => this.heading().nativeElement.focus());
    });
  }
}
