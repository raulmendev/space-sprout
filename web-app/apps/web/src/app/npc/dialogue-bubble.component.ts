import { Component, computed, inject, linkedSignal, output } from '@angular/core';
import { CrewId, HealthMetric, METRICS, choicesFor, unknownRewardFor, validateMeasurement } from '@garden/shared';
import { Line, NpcStore } from './npc.store';
import { AssetService } from '../shared/assets.service';
import { MoodPickerComponent } from '../health/mood-picker.component';
import { NPC_IDENTITY } from './npc-identity';
import type { CrewAnswer } from './crew-reminders';

@Component({
  selector: 'app-dialogue-bubble',
  imports: [MoodPickerComponent],
  template: `
    @if (npc.current(); as line) {
      @let who = identity[line.speaker];
      <div class="panel bubble flex gap-3 p-3 pr-4" role="dialog" aria-live="polite" [attr.aria-label]="who.name + ' says'">
        <img [src]="assets.url(who.texture)" alt="" class="pixelated size-16 shrink-0 rounded-md bg-parchment object-cover object-bottom" />
        <div class="min-w-0 flex-1">
          <div class="font-pixel text-sm text-leaf-dark">
            {{ who.name }}@if (who.role) {<span class="ml-1.5 font-sans text-xs font-bold text-bark/60">{{ who.role }}</span>}
          </div>
          <p class="mt-0.5 text-[15px] leading-snug">{{ line.text }}</p>

          @if (line.ask && line.speaker !== 'SPROUT') {
            @if (line.scan) {
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="rounded-md border-2 border-bark-dark bg-sun px-3 py-1 text-sm font-bold" (click)="scan.emit(line.speaker)">📡 Scan</button>
                <button type="button" class="rounded-md border-2 border-bark-dark bg-parchment px-3 py-1 text-sm font-bold hover:bg-sun" (click)="putOff(line)">Later</button>
              </div>
            } @else if (choices(line.ask); as opts) {
              <div class="mt-2 flex flex-wrap gap-1.5" role="group" [attr.aria-label]="metrics[line.ask].label">
                @for (o of opts; track o.id) {
                  <button
                    type="button"
                    class="rounded-md border-2 border-bark/40 bg-parchment px-2 py-0.5 text-sm font-bold hover:bg-sun focus-visible:outline-2 focus-visible:outline-sun"
                    (click)="answer.emit({ speaker: line.speaker, metric: line.ask, value: o.value! })"
                  ><span aria-hidden="true">{{ o.icon }}</span> {{ o.label }}</button>
                }
              </div>
              <button type="button" class="mt-1.5 text-xs font-bold underline" (click)="putOff(line)">Later</button>
            } @else if (line.ask === 'MOOD') {
              <app-mood-picker class="mt-2" (pick)="answer.emit({ speaker: line.speaker, metric: 'MOOD', value: $event })" />
              <button type="button" class="mt-1.5 text-xs font-bold underline" (click)="putOff(line)">Later</button>
            } @else {
              @let def = metrics[line.ask];
              <form
                class="mt-2 flex flex-wrap items-center gap-2"
                (submit)="$event.preventDefault(); draft() !== '' && !error() && answer.emit({ speaker: line.speaker, metric: line.ask, value: +draft() })"
              >
                <span class="flex items-center gap-1">
                  <input
                    type="number"
                    inputmode="decimal"
                    class="w-20 rounded-md border-2 border-bark/30 bg-cream px-2 py-1 text-right focus-visible:outline-2 focus-visible:outline-sun"
                    [min]="def.min" [max]="def.max" [step]="def.step"
                    [value]="draft()"
                    (input)="draft.set($any($event.target).value)"
                    [attr.aria-label]="def.label + ' (' + def.unit + ')'"
                    [attr.aria-invalid]="!!error()"
                  />
                  <span class="text-xs text-bark/70">{{ def.unit }}</span>
                </span>
                <button
                  type="submit"
                  class="rounded-md border-2 border-bark-dark bg-sun px-3 py-1 text-sm font-bold disabled:opacity-50"
                  [disabled]="draft() === '' || !!error()"
                >Log it</button>
                @if (canSayUnknown(line.ask)) {
                  <button type="button" class="rounded-md border-2 border-bark-dark bg-parchment px-3 py-1 text-sm font-bold hover:bg-sun" (click)="unknown.emit({ speaker: line.speaker, metric: line.ask })">Don't know</button>
                }
                <button type="button" class="rounded-md border-2 border-bark-dark bg-parchment px-3 py-1 text-sm font-bold hover:bg-sun" (click)="putOff(line)">Later</button>
              </form>
              @if (error(); as e) { <p class="mt-1 text-xs font-bold text-[#a33]" role="alert">{{ e }}</p> }
            }
          } @else if (line.actions?.length) {
            <div class="mt-2 flex flex-wrap gap-2">
              @for (a of line.actions; track a.action) {
                <button
                  type="button"
                  class="rounded-md border-2 border-bark-dark bg-parchment px-3 py-1 text-sm font-bold hover:bg-sun focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun"
                  (click)="action.emit(a.action)"
                >
                  {{ a.label }}
                </button>
              }
            </div>
          }
        </div>
        <button type="button" class="self-start text-bark/70 hover:text-bark-dark" aria-label="Close" (click)="putOff(line)">✕</button>
      </div>
    }
  `,
  styles: `
    .bubble { animation: pop 220ms cubic-bezier(.2,1.4,.4,1); }
    @keyframes pop { from { transform: translateY(8px) scale(.96); opacity: 0; } }
  `,
})
export class DialogueBubbleComponent {
  protected readonly npc = inject(NpcStore);
  protected readonly assets = inject(AssetService);
  readonly action = output<string>();
  readonly answer = output<CrewAnswer>();
  readonly unknown = output<{ speaker: CrewId; metric: HealthMetric }>();
  readonly scan = output<CrewId>();
  /** A crew member's question was put off ("Later" or ✕). */
  readonly later = output<CrewId>();

  protected readonly identity = NPC_IDENTITY;
  protected readonly metrics = METRICS;
  /** Answer buttons for scale questions other than mood (stress); null when it's typed in. */
  protected choices = (m: HealthMetric) => (m === 'MOOD' || !choicesFor(m).length ? null : choicesFor(m));
  protected canSayUnknown = (m: HealthMetric) => unknownRewardFor(m) !== null;

  /** Putting off a crew question gets a goodbye with a reminder; anything else just closes. */
  protected putOff(line: Line): void {
    if (line.ask && line.speaker !== 'SPROUT') this.later.emit(line.speaker);
    else this.npc.dismiss();
  }
  /** The typed answer; every new line starts with an empty field. */
  protected readonly draft = linkedSignal(() => (this.npc.current(), ''));

  protected readonly error = computed(() => {
    const ask = this.npc.current()?.ask;
    const raw = this.draft();
    return ask && raw !== '' ? validateMeasurement(ask, Number(raw)) : null;
  });
}
