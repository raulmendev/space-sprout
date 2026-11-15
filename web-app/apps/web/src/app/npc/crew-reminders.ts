import { Injectable, effect, inject, untracked } from '@angular/core';
import { CREW, CREW_BY_ID, CREW_REMINDER, CrewId, CrewMember, HealthMetric, distance, nextAsk } from '@garden/shared';
import { HealthStore } from '../health/health.store';
import { HabitatStore } from '../habitat/habitat.store';
import { PlayerStore } from '../habitat/player.store';
import { ASK_LINES, CREW_LINES } from './crew-lines';
import { NpcActorStore } from './npc-actor.store';
import { NpcStore } from './npc.store';

/** How often to check whether someone should come over (ms). */
const CHECK_EVERY = 500;

export interface CrewAnswer {
  speaker: CrewId;
  metric: HealthMetric;
  value: number;
}

/**
 * When the crew come over to ask about a reading you haven't logged today.
 * A reminder, not a second terminal: each asks at most once every few minutes,
 * only in your room and when you're close, never while something else is open,
 * and stops for the day once their readings are in.
 */
@Injectable({ providedIn: 'root' })
export class CrewReminders {
  private readonly actors = inject(NpcActorStore);
  private readonly health = inject(HealthStore);
  private readonly habitat = inject(HabitatStore);
  private readonly player = inject(PlayerStore);
  private readonly npc = inject(NpcStore);

  private readonly lastAsked = new Map<CrewId, number>();
  /** No unasked reminder from anyone before this time. */
  private nextReminderAt = performance.now() + CREW_REMINDER.firstAfterMs;

  constructor() {
    setInterval(this.check, CHECK_EVERY);
    // Opening a panel (e.g. the terminal) drops a crew question: it could go stale behind it.
    effect(() => {
      if (this.habitat.busy() && this.crewSpeaking()) untracked(() => this.npc.dismiss());
    });
  }

  /** The player tapped a crew member (and walked up): always answer. */
  talk(id: CrewId): void {
    this.lastAsked.set(id, performance.now());
    const metric = nextAsk(CREW_BY_ID[id], this.health.today());
    this.npc.sayAs(id, metric ? ASK_LINES[metric] : CREW_LINES[id].allDone, metric ?? undefined);
  }

  /** Quick answer from the bubble: saved like a terminal reading (same rules, same seeds). */
  async answer({ speaker, metric, value }: CrewAnswer): Promise<void> {
    const earned = await this.health.submitManual({ [metric]: value });
    const thanks = CREW_LINES[speaker].thanks + (earned ? ` 🌱 +${earned}` : '');
    const next = nextAsk(CREW_BY_ID[speaker], this.health.today());
    this.npc.sayAs(speaker, next ? `${thanks} ${ASK_LINES[next]}` : thanks, next ?? undefined);
  }

  reset(): void {
    this.lastAsked.clear();
    this.nextReminderAt = performance.now() + CREW_REMINDER.firstAfterMs;
    this.actors.reset();
  }

  /** The crew member speaking right now, if any (not Sprout). */
  private crewSpeaking(): CrewId | null {
    const id = this.npc.current()?.speaker;
    return id && id !== 'SPROUT' ? id : null;
  }

  private readonly check = (): void => {
    const now = performance.now();
    const me = this.player.position();

    // Walked off mid-question: they let it go.
    const speaking = this.crewSpeaking();
    if (speaking) {
      const c = this.actors.get(speaking)!.position;
      if (c.room !== me.room || distance(c, me) > CREW_REMINDER.leaveRadius) this.npc.dismiss();
      return;
    }
    if (now < this.nextReminderAt || this.npc.current() || this.habitat.busy()) return;

    // The nearest crew member in reach who's free to ask and has something to ask.
    const today = this.health.today();
    let pick: { member: CrewMember; d: number } | null = null;
    for (const member of CREW) {
      const at = this.actors.get(member.id)!.position;
      const d = distance(at, me);
      if (at.room !== me.room || d > CREW_REMINDER.noticeRadius || (pick && d >= pick.d)) continue;
      if (now - (this.lastAsked.get(member.id) ?? -Infinity) < CREW_REMINDER.perMemberMs) continue;
      if (nextAsk(member, today)) pick = { member, d };
    }
    if (!pick) return;

    const { member } = pick;
    this.lastAsked.set(member.id, now);
    this.nextReminderAt = now + CREW_REMINDER.anyoneMs;
    this.actors.comeOver(member.id, () => {
      // Things may have changed on the way (a panel opened, it got logged at the terminal).
      const metric = nextAsk(member, this.health.today());
      if (metric && !this.habitat.busy() && !this.npc.current()) this.npc.sayAs(member.id, ASK_LINES[metric], metric);
    });
  };
}
