import { Injectable, signal } from '@angular/core';
import type { Dialogue, DialogueTrigger } from '@garden/shared';
import { dialoguesFor } from './dialogues';

/**
 * Controls when Sprout speaks. Respects dismissal: automatic (non user-initiated)
 * lines are rate-limited so the NPC never nags.
 */
@Injectable({ providedIn: 'root' })
export class NpcStore {
  readonly current = signal<Dialogue | null>(null);
  private readonly lastAuto = new Map<DialogueTrigger, number>();
  private readonly counters = new Map<DialogueTrigger, number>();
  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  /** Cooldown for automatic lines (ms). */
  private static readonly AUTO_COOLDOWN = 45_000;

  /** User clicked Sprout: always answer. */
  talk(): void {
    const greetings = dialoguesFor('GREETING');
    this.show(this.next('GREETING', greetings));
  }

  /** System-initiated line: only if nothing is showing and cooldown passed. */
  maybeSay(trigger: DialogueTrigger): void {
    if (this.current()) return;
    const last = this.lastAuto.get(trigger) ?? 0;
    if (Date.now() - last < NpcStore.AUTO_COOLDOWN) return;
    const options = dialoguesFor(trigger);
    if (!options.length) return;
    this.lastAuto.set(trigger, Date.now());
    const line = this.next(trigger, options);
    this.show(line);
    if (!line.actions?.length) this.autoCloseTimer = setTimeout(() => this.dismiss(), 4500);
  }

  say(trigger: DialogueTrigger): void {
    const options = dialoguesFor(trigger);
    if (options.length) this.show(this.next(trigger, options));
  }

  dismiss(): void {
    clearTimeout(this.autoCloseTimer);
    this.current.set(null);
  }

  private show(d: Dialogue): void {
    clearTimeout(this.autoCloseTimer);
    this.current.set(d);
  }

  private next(trigger: DialogueTrigger, options: Dialogue[]): Dialogue {
    const n = this.counters.get(trigger) ?? 0;
    this.counters.set(trigger, n + 1);
    return options[n % options.length];
  }
}
