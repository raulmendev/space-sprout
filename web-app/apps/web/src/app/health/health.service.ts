import { Injectable } from '@angular/core';
import {
  type HealthCommand,
  type HealthMeasurement,
  type HealthRecord,
  type HealthReply,
  type HealthView,
  emptyHealthRecord,
  runHealth,
  toMeasurement,
  viewOfHealth,
} from '@garden/shared';
import { simulatedValue } from './simulated-wearable';
import { CURRENT_USER, MY_METRICS, perMemberKey } from '../session/current-user';
import { OFFLINE_MESSAGE, onStation, sendCommand, stationCall } from '../session/member-session';
import { LOCAL_GARDEN_ID } from '../garden/garden.service';
import { loadJson, saveJson } from '../shared/storage';

/** A health command that couldn't reach the station; the message is shown as is. */
export class HealthUnreachable extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
  }
}

/**
 * The player's health record. Signed in, it lives on the server, private to them: the server runs
 * the shared rules (`runHealth`) and pays the seeds into the station's garden in the same
 * transaction. Otherwise (the dev `?user=` stand-in) a copy is kept on this device and the same
 * rules run here.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  // One record per player.
  private static readonly KEY = perMemberKey('health');
  private readonly remote = onStation();

  async load(): Promise<HealthView> {
    return this.remote ? stationCall<HealthView>('/health/me') : viewOfHealth(this.localRecord());
  }

  /** Readings, a "don't know" or a goal (sent once, however many tries it takes, so it can't pay twice). */
  async run(command: HealthCommand): Promise<HealthReply> {
    if (!this.remote) return this.runLocally(command);
    const reply = await sendCommand<HealthReply>('/health/me/commands', command);
    if (!reply) throw new HealthUnreachable();
    return reply;
  }

  /** Demo: start the local record over (a station's record is never reset from here). */
  reset(): void {
    if (!this.remote) saveJson(HealthService.KEY, null);
  }

  private runLocally(command: HealthCommand): HealthReply {
    const { record, result } = runHealth(this.localRecord(), command, CURRENT_USER, LOCAL_GARDEN_ID, Date.now(), () => crypto.randomUUID());
    saveJson(HealthService.KEY, record);
    return { result, view: viewOfHealth(record) };
  }

  private localRecord(): HealthRecord {
    const saved = loadJson<Partial<HealthRecord> | null>(HealthService.KEY, null);
    if (saved) return { ...emptyHealthRecord(), ...saved }; // older saves may lack unknowns or goals
    const seeded = { ...emptyHealthRecord(), measurements: seedHistory() };
    saveJson(HealthService.KEY, seeded);
    return seeded;
  }
}

/**
 * The local demo's month of labelled simulated history, so trends, usual ranges and the 30-day view have
 * something to show in the demo. A few days are skipped, so the check-in streak is short
 * (2 days up to yesterday) and today's check-in reaches the first streak milestone.
 */
const SEED_DAYS = 29;
const SEED_SKIPPED = new Set([3, 11, 12, 20]);

function seedHistory(): HealthMeasurement[] {
  let s = 7;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const out: HealthMeasurement[] = [];
  for (let daysAgo = SEED_DAYS; daysAgo >= 1; daysAgo--) {
    if (SEED_SKIPPED.has(daysAgo)) continue;
    const at = new Date(Date.now() - daysAgo * 86_400_000);
    at.setUTCHours(7, 30, 0, 0);
    for (const metric of MY_METRICS) {
      const value = metric === 'MOOD' ? 3 + Math.round(rand() * 2) : simulatedValue(metric, rand);
      out.push(toMeasurement({ metric, value, measuredAt: at.toISOString(), source: 'SIMULATED' }, crypto.randomUUID(), CURRENT_USER.id));
    }
  }
  return out;
}
