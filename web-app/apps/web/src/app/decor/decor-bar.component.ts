import { Component, computed, inject, output } from '@angular/core';
import { decorSpec } from '@garden/shared';
import { DecorOutcome, DecorStore } from './decor.store';
import { LOCAL_PLAYER } from '../garden/garden.service';
import { timeAgo } from '../health/format';
import { whoDid } from '../shared/format';
import { t } from '../i18n/i18n';

/**
 * The bar in the room while decorating: placing or moving a decoration ("tap a glowing spot",
 * then Place here / Cancel), or the menu of a placed one (Move / Put away).
 */
@Component({
  selector: 'app-decor-bar',
  template: `
    <div class="panel flex items-center gap-3 p-3 short:gap-2 short:p-2" role="region" [attr.aria-label]="title()">
      <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-parchment text-2xl short:size-8 short:text-xl" aria-hidden="true">{{ decor.item()?.icon }}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-bold leading-tight">{{ title() }}</p>
        <p class="text-xs text-bark/80" role="status">{{ hint() }}</p>
      </div>
      @if (decor.mode(); as m) {
        <button type="button" class="btn btn-press bg-sun" [disabled]="!decor.candidate()" (click)="finish(decor.confirm())">
          {{ t(m.kind === 'PLACE' ? 'Place here' : 'Move here') }}
        </button>
        <button type="button" class="btn btn-press bg-parchment hover:bg-sun" (click)="decor.clear()">{{ t('Cancel') }}</button>
      } @else {
        @if (decor.selectedWaterable()) {
          <button type="button" class="btn btn-press" [class]="decor.selectedThirsty() ? 'bg-sun' : 'bg-parchment hover:bg-sun'" (click)="finish(decor.water())">💧 {{ t('Water|verb') }}</button>
        }
        <button type="button" class="btn btn-press bg-parchment hover:bg-sun" (click)="decor.startMove()">{{ t('Move') }}</button>
        <button type="button" class="btn btn-press bg-parchment hover:bg-sun" (click)="finish(decor.putAway())">{{ t('Put away') }}</button>
        <button type="button" class="self-start text-bark/70 hover:text-bark-dark" [attr.aria-label]="t('Close')" (click)="decor.clear()">✕</button>
      }
    </div>
  `,
  styles: `
    .btn { padding: 0.25rem 0.75rem; font-size: 0.875rem; font-weight: 700; }
    .btn:disabled { opacity: 0.5; }
  `,
})
export class DecorBarComponent {
  protected readonly decor = inject(DecorStore);
  /** A place / move / put away finished (or failed): the app shows the message. */
  readonly done = output<DecorOutcome>();
  protected readonly t = t;

  protected readonly title = computed(() => {
    const name = this.decor.item()?.name ?? '';
    const m = this.decor.mode();
    if (!m) return t(name);
    const what = t(`the ${name.toLowerCase()}`);
    return m.kind === 'PLACE' ? t('Place {what}', { what }) : t('Move {what}', { what });
  });

  protected readonly hint = computed(() => {
    const m = this.decor.mode();
    if (!m) {
      const d = this.decor.selected();
      if (!d) return '';
      if (this.decor.selectedWaterable()) {
        if (this.decor.selectedThirsty()) return t('Thirsty. A drink would help it shine.');
        return t('Watered by {who}, {when}.', { who: whoDid(d.care?.by, d.care?.byName, LOCAL_PLAYER.id), when: timeAgo(d.care!.lastWateredAt) });
      }
      return t('Put up by {who}, {when}.', { who: whoDid(d.placedBy, d.placedByName, LOCAL_PLAYER.id), when: timeAgo(d.placedAt) });
    }
    if (this.decor.candidate()) return t('Looks good? Or tap another spot.');
    if (!this.decor.spotTiles()?.length) return t('No free spot here. Put something away first.');
    return decorSpec(m.itemId)?.mount === 'WALL' ? t('Tap a glowing spot on the wall.') : t('Tap a glowing spot on the floor.');
  });

  protected async finish(pending: Promise<DecorOutcome | null>): Promise<void> {
    const outcome = await pending;
    if (outcome) this.done.emit(outcome);
  }
}
