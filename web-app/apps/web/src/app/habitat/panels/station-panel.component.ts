import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { ALL_PROPS, ROOMS } from '@garden/shared';
import type { HabitatPanel } from '../habitat.store';
import { MedicalTerminalPanelComponent } from '../../health/medical-terminal-panel.component';
import { HealthInsightsPanelComponent } from '../../health/health-insights-panel.component';
import { MessageBoardPanelComponent } from '../../social/message-board-panel.component';
import { StorePanelComponent } from '../../store/store-panel.component';
import { InventoryPanelComponent } from '../../store/inventory-panel.component';
import { t } from '../../i18n/i18n';

/** Panels drawn in the steel console frame; their content supplies its own cream screen. */
const CONSOLE_PANELS: ReadonlySet<HabitatPanel> = new Set(['MEDICAL_TERMINAL_SELECTED', 'HEALTH_INSIGHTS_SELECTED', 'MESSAGE_BOARD_SELECTED', 'STORE_SELECTED', 'INVENTORY']);

/** A more specific subtitle than the room name, where one helps. English here; shown through t(). */
const SUBTITLES: Partial<Record<HabitatPanel, string>> = { STORE_SELECTED: 'Habitat Supplies' };

/** Popups that aren't opened from a prop bring their own title. */
const OWN_TITLES: Partial<Record<HabitatPanel, { title: string; zone: string }>> = { INVENTORY: { title: 'Inventory', zone: 'Household' } };

/** Panels opened from habitat objects. */
@Component({
  selector: 'app-station-panel',
  imports: [MedicalTerminalPanelComponent, HealthInsightsPanelComponent, MessageBoardPanelComponent, StorePanelComponent, InventoryPanelComponent],
  // Fills the popup's fixed height. The header stays put and the body below it scrolls when its
  // content is taller. Content can fill the body instead (min-h-0 flex-1 on itself, a scrolling
  // region inside), like the store catalog.
  host: { class: 'flex min-h-0 flex-1 flex-col', '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <section
      class="panel @container flex min-h-0 flex-1 flex-col gap-3 p-4 short:gap-2 short:p-3"
      [class.console]="console()"
      role="region"
      [attr.aria-labelledby]="'panel-title'"
    >
      <header class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2">
          <!-- Console badge: what this station is, at a glance. -->
          @switch (panel()) {
            @case ('MEDICAL_TERMINAL_SELECTED') {
              <svg class="size-8 shrink-0 short:size-7" viewBox="0 0 32 32" aria-hidden="true">
                <rect class="ink" x="1.5" y="1.5" width="29" height="29" rx="8" fill="#3fa7e8" stroke-width="3" />
                <path class="ink" d="M12.5 7h7v5.5H25v7h-5.5V25h-7v-5.5H7v-7h5.5z" fill="#fff" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            }
            @case ('HEALTH_INSIGHTS_SELECTED') {
              <!-- Insights badge: a little chart on a screen -->
              <svg class="size-8 shrink-0 short:size-7" viewBox="0 0 32 32" aria-hidden="true">
                <rect class="ink" x="1.5" y="1.5" width="29" height="29" rx="8" fill="#5fae5a" stroke-width="3" />
                <path class="ink" d="M7 21l5-6 4 3 5-7 4 4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="25" cy="15" r="2.5" fill="#f6c945" class="ink" stroke-width="1.5" />
              </svg>
            }
            @case ('MESSAGE_BOARD_SELECTED') {
              <svg class="size-9 shrink-0 short:size-7" viewBox="0 0 36 32" aria-hidden="true">
                <rect class="ink" x="2" y="5" width="32" height="23" rx="3" fill="#fbf3e4" stroke-width="3" />
                <path class="ink" d="M3.5 7 18 18 32.5 7" fill="none" stroke-width="2.5" stroke-linejoin="round" />
                <path class="ink" d="M18 25s-6-3.6-6-7.4a3.3 3.3 0 0 1 6-1.8 3.3 3.3 0 0 1 6 1.8c0 3.8-6 7.4-6 7.4z" fill="#e8577a" stroke-width="1.8" stroke-linejoin="round" />
              </svg>
            }
            @case ('STORE_SELECTED') {
              <!-- Shop badge: a little storefront with a striped awning -->
              <svg class="size-8 shrink-0 short:size-7" viewBox="0 0 32 32" aria-hidden="true">
                <rect class="ink" x="5" y="13" width="22" height="16" rx="2" fill="#fff6e3" stroke-width="2.5" />
                <rect class="ink" x="15" y="18" width="8" height="7" rx="1" fill="#8fc4f0" stroke-width="2" />
                <rect class="ink" x="8" y="19" width="5" height="10" fill="#c98a5a" stroke-width="2" />
                <path class="ink" d="M3 13l3-9h20l3 9z" fill="#fff" stroke-width="2.5" stroke-linejoin="round" />
                <path d="M8.5 4.5L7 13M13.5 4.5L13 13M18.5 4.5L19 13M23.5 4.5L25 13" stroke="#e05a4f" stroke-width="3" />
                <path class="ink" d="M3 13l3-9h20l3 9z" fill="none" stroke-width="2.5" stroke-linejoin="round" />
              </svg>
            }
            @case ('INVENTORY') {
              <!-- Backpack badge -->
              <svg class="size-8 shrink-0 short:size-7" viewBox="0 0 32 32" aria-hidden="true">
                <path class="ink" d="M12 7V5a4 4 0 0 1 8 0v2" fill="none" stroke-width="2.5" />
                <rect class="ink" x="5" y="7" width="22" height="22" rx="7" fill="#e58a4a" stroke-width="2.5" />
                <rect class="ink" x="9" y="16" width="14" height="10" rx="3" fill="#f7b267" stroke-width="2" />
                <path class="ink" d="M9 20h14" stroke-width="2" />
                <rect class="ink" x="14" y="18.5" width="4" height="3" rx="1" fill="#fbd23a" stroke-width="1.5" />
              </svg>
            }
          }
          <h2 id="panel-title" #heading tabindex="-1" class="font-pixel text-2xl leading-tight outline-none short:text-xl">{{ meta().title }}</h2>
          <p class="zone text-xs font-bold uppercase tracking-wide text-bark/70">{{ meta().zone }}</p>
        </div>
        @if (console()) {
          <span class="ml-auto hidden items-center gap-3 @lg:flex" aria-hidden="true">
            <span class="stripes h-3.5 w-13"></span>
            <span class="flex gap-1"><i class="light bg-leaf"></i><i class="light bg-sun"></i><i class="light bg-cream/30"></i></span>
          </span>
        }
        <button
          type="button"
          [class]="console() ? 'console-close btn-press' : 'grid size-8 place-items-center rounded-full hover:bg-parchment focus-visible:outline-2 focus-visible:outline-sun'"
          [attr.aria-label]="t('Close panel')"
          (click)="closed.emit()"
        >✕</button>
      </header>

      <div class="panel-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain short:gap-2">
      @switch (panel()) {
        @case ('MEDICAL_TERMINAL_SELECTED') {
          <app-medical-terminal-panel />
        }
        @case ('HEALTH_INSIGHTS_SELECTED') {
          <app-health-insights-panel />
        }
        @case ('MESSAGE_BOARD_SELECTED') {
          <app-message-board-panel />
        }
        @case ('STORE_SELECTED') {
          <app-store-panel />
        }
        @case ('INVENTORY') {
          <app-inventory-panel />
        }
      }
      </div>
    </section>
  `,
  styles: `
    /* Console frame: a steel bezel with a light header; the panel's own content is the cream "screen". */
    .console {
      background: linear-gradient(180deg, #66729e, var(--color-steel) 40%);
      border-color: var(--color-steel-dark);
      border-radius: 14px;
      color: var(--color-cream);
      box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.25), inset 0 -4px 0 rgb(0 0 0 / 0.2), 0 6px 0 rgb(0 0 0 / 0.3);
      --stripe: color-mix(in srgb, var(--color-cream) 35%, transparent);
    }
    .console header { align-items: center; }
    .console .zone { color: color-mix(in srgb, var(--color-cream) 70%, transparent); }
    .ink { stroke: var(--color-steel-dark); }
    .light { display: block; width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--color-steel-dark); }
    .console-close {
      --press: var(--color-steel-dark);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 8px;
      background: var(--color-cream);
      color: var(--color-alert);
      font-weight: 900;
      font-size: 1.1rem;
    }
    .console-close:hover { background: #fff; }

    /* Same breakpoint as the short: variant in styles.css. */
    @media (max-height: 500px) {
      .console { padding: 8px 10px 10px; gap: 6px; }
      .console-close { width: 1.85rem; height: 1.85rem; font-size: 1rem; }
    }
    /* Keyboard up: every pixel above it goes to what is being typed (Esc / Cancel still close). */
    :host-context(.keyboard-open) header { display: none; }
    :host-context(.keyboard-open) .console { padding: 4px; }
  `,
})
export class StationPanelComponent {
  protected readonly t = t;
  readonly panel = input.required<HabitatPanel>();
  readonly closed = output<void>();
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  /** Panels drawn as a station console (steel bezel, cream screen). */
  protected readonly console = computed(() => CONSOLE_PANELS.has(this.panel()));

  /** Title and zone: the panel's own, or from the habitat data for the prop that opens it. */
  protected readonly meta = computed(() => {
    const own = OWN_TITLES[this.panel()];
    if (own) return { title: t(own.title), zone: t(own.zone) };
    const prop = ALL_PROPS.find((p) => p.interaction === this.panel())!;
    return { title: t(prop.name), zone: t(SUBTITLES[this.panel()] ?? ROOMS[prop.room].name) };
  });

  constructor() {
    // Move focus into the panel whenever a different panel opens (keyboard users).
    effect(() => {
      this.panel();
      queueMicrotask(() => this.heading().nativeElement.focus());
    });
  }
}
