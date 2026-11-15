import { Injectable, effect, inject, untracked } from '@angular/core';
import { CREW_REMINDER, CrewId, CrewMember, HealthMetric, METRICS, UNKNOWN_BAND, bandFor, distance, isCrew, nextAsk } from '@garden/shared';
import { MY_CREW, MY_CREW_BY_ID, ROLE } from '../session/current-user';
import { HealthStore } from '../health/health.store';
import { HabitatStore } from '../habitat/habitat.store';
import { PlayerStore } from '../habitat/player.store';
import { ALL_DONE, ASK, INTRO, LATER, NOTHING_TO_ASK, SCAN_NOTE, SCAN_RESULT, pick, replyLines } from './crew-lines';
import { simulatedValue } from '../health/simulated-wearable';
import { formatValue } from '../health/format';
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
    const metric = nextAsk(MY_CREW_BY_ID[id], this.health.answeredToday());
    if (metric) this.ask(MY_CREW_BY_ID[id], metric);
    else this.npc.sayAs(id, pick(MY_CREW_BY_ID[id].metrics.length ? ALL_DONE[id] : NOTHING_TO_ASK[id]));
  }

  /** Quick answer from the bubble: saved like a terminal reading (same rules, same seeds). */
  async answer({ speaker, metric, value }: CrewAnswer): Promise<void> {
    const earned = await this.health.submitManual({ [metric]: value });
    this.reply(speaker, metric, bandFor(metric, value, ROLE)?.id, earned);
  }

  /** "I don't know": nothing is stored as a reading; the crew nudge you to measure next time. */
  async answerUnknown(speaker: CrewId, metric: HealthMetric): Promise<void> {
    const earned = await this.health.answerUnknown(metric);
    this.reply(speaker, metric, UNKNOWN_BAND, earned);
  }

  /** The scientist reads his instruments: every reading of his at once, labelled as simulated. */
  async scan(speaker: CrewId): Promise<void> {
    const member = MY_CREW_BY_ID[speaker];
    const values: Partial<Record<HealthMetric, number>> = {};
    for (const m of member.metrics) values[m] = simulatedValue(m);
    const earned = await this.health.submitManual(values, 'SIMULATED');
    const level = (m: HealthMetric) => formatValue({ metric: m, value: values[m] ?? 0 });
    const note = (m: HealthMetric) => SCAN_NOTE[m]?.[bandFor(m, values[m] ?? 0, ROLE)?.id ?? ''] ?? METRICS[m].label;
    const text = pick(SCAN_RESULT)
      .replace('{rad}', level('RADIATION'))
      .replace('{radNote}', note('RADIATION'))
      .replace('{co2}', level('CO2'))
      .replace('{co2Note}', note('CO2'));
    this.npc.sayAs(speaker, `${text}${seeds(earned)} ${pick(ALL_DONE[speaker])}`);
  }

  /**
   * You put their question off ("Later" or ✕): they let you go, with a reminder to
   * finish at the Medical Station. Whoever finds you next asks again, in any order.
   */
  later(speaker: CrewId): void {
    this.npc.sayAs(speaker, pick(LATER[speaker]));
  }

  /** Their reply to an answer, then their next question (or goodbye). */
  private reply(speaker: CrewId, metric: HealthMetric, band: string | undefined, earned: number): void {
    const lines = band ? replyLines(metric, band, ROLE) : undefined;
    const said = (lines ? pick(lines) : 'Noted, thank you!') + seeds(earned);
    const member = MY_CREW_BY_ID[speaker];
    const next = nextAsk(member, this.health.answeredToday());
    if (next) this.npc.sayAs(speaker, `${said} ${pick(ASK[next])}`, next, !!member.scans);
    else this.npc.sayAs(speaker, `${said} ${pick(ALL_DONE[speaker])}`);
  }

  /** A question; the first of the day comes with their hello. */
  private ask(member: CrewMember, metric: HealthMetric): void {
    const answered = this.health.answeredToday();
    const first = !member.metrics.some((m) => answered[m]);
    const question = member.scans ? '' : pick(ASK[metric]);
    const text = first ? `${pick(INTRO[member.id])} ${question}`.trim() : question || pick(ASK[metric]);
    this.npc.sayAs(member.id, text, metric, !!member.scans);
  }

  reset(): void {
    this.lastAsked.clear();
    this.nextReminderAt = performance.now() + CREW_REMINDER.firstAfterMs;
    this.actors.reset();
  }

  /** The crew member speaking right now, if any (not a pet). */
  private crewSpeaking(): CrewId | null {
    const id = this.npc.current()?.speaker;
    return id && isCrew(id) ? id : null;
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
    const today = this.health.answeredToday();
    let nearest: { member: CrewMember; d: number } | null = null;
    for (const member of MY_CREW) {
      const at = this.actors.get(member.id)!.position;
      const d = distance(at, me);
      if (at.room !== me.room || d > CREW_REMINDER.noticeRadius || (nearest && d >= nearest.d)) continue;
      if (now - (this.lastAsked.get(member.id) ?? -Infinity) < CREW_REMINDER.perMemberMs) continue;
      if (nextAsk(member, today)) nearest = { member, d };
    }
    if (!nearest) return;

    const { member } = nearest;
    this.lastAsked.set(member.id, now);
    this.nextReminderAt = now + CREW_REMINDER.anyoneMs;
    this.actors.comeOver(member.id, () => {
      // Things may have changed on the way (a panel opened, it got logged at the terminal).
      const metric = nextAsk(member, this.health.answeredToday());
      if (metric && !this.habitat.busy() && !this.npc.current()) this.ask(member, metric);
    });
  };
}

/** " 🌱 +3" after a line that earned seeds. */
function seeds(earned: number): string {
  return earned ? ` 🌱 +${earned}` : '';
}
