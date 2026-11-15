import { Component, output } from '@angular/core';
import { MOODS } from './format';

/** One-tap mood check-in: five faces. Used by the terminal's checklist and the medic's question. */
@Component({
  selector: 'app-mood-picker',
  host: { class: 'flex justify-between gap-1', role: 'group', 'aria-label': 'How are you feeling?' },
  template: `
    @for (mood of moods; track mood.value) {
      <button
        type="button"
        class="flex flex-1 flex-col items-center rounded-md border-2 border-transparent bg-parchment/70 py-0.5 text-[10px] hover:border-bark/40 focus-visible:outline-2 focus-visible:outline-sun"
        [attr.aria-label]="'Mood: ' + mood.label"
        (click)="pick.emit(mood.value)"
      ><span class="text-lg leading-tight" aria-hidden="true">{{ mood.face }}</span>{{ mood.label }}</button>
    }
  `,
})
export class MoodPickerComponent {
  protected readonly moods = MOODS;
  readonly pick = output<number>();
}
