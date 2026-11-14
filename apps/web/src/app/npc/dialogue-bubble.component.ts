import { Component, inject, output } from '@angular/core';
import { NpcStore } from './npc.store';
import { spriteIcon } from '../garden/game/plant-sprites';

@Component({
  selector: 'app-dialogue-bubble',
  template: `
    @if (npc.current(); as line) {
      <div class="panel bubble flex gap-3 p-3 pr-4" role="dialog" aria-live="polite" aria-label="Sprout says">
        <img [src]="portrait" alt="" class="pixelated size-14 shrink-0 rounded-md bg-parchment p-1" />
        <div class="min-w-0 flex-1">
          <div class="font-pixel text-sm text-leaf-dark">Sprout</div>
          <p class="mt-0.5 text-[15px] leading-snug">{{ line.text }}</p>
          @if (line.actions?.length) {
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
        <button type="button" class="self-start text-bark/70 hover:text-bark-dark" aria-label="Close" (click)="npc.dismiss()">✕</button>
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
  protected readonly portrait = spriteIcon('npc', 4);
  readonly action = output<string>();
}
