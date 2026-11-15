import { Injectable, signal } from '@angular/core';
import type { Dialogue, DialogueTrigger, HealthMetric, NpcId } from '@garden/shared';
import { dialoguesFor } from './dialogues';

/** A line on screen. With `ask`, the bubble offers a quick answer for that reading. */
export interface Line extends Omit<Dialogue, 'trigger'> {
  speaker: NpcId;
  ask?: HealthMetric;
}

/**
 * Controls what's said in the speech bubble: Sprout's lines and the crew's. Respects dismissal: automatic (non user-initiated)
 * lines are rate-limited so the NPC never nags.
 */
@Injectable({ providedIn: 'root' })
export class NpcStore {
  readonly current = signal<Line | null>(null);
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

  /** Someone says a line. Lines without a question fade on their own. */
  sayAs(speaker: NpcId, text: string, ask?: HealthMetric): void {
    clearTimeout(this.autoCloseTimer);
    this.current.set({ id: `${speaker}:${ask ?? 'line'}`, speaker, text, ask });
    if (!ask) this.autoCloseTimer = setTimeout(() => this.dismiss(), 4500);
  }

  dismiss(): void {
    clearTimeout(this.autoCloseTimer);
    this.current.set(null);
  }

  /** One of Sprout's predefined lines. */
  private show(d: Dialogue): void {
    clearTimeout(this.autoCloseTimer);
    this.current.set({ ...d, speaker: 'SPROUT' });
  }

  private next(trigger: DialogueTrigger, options: Dialogue[]): Dialogue {
    const n = this.counters.get(trigger) ?? 0;
    this.counters.set(trigger, n + 1);
    return options[n % options.length];
  }
}
