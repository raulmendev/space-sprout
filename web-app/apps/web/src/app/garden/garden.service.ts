import { Injectable } from '@angular/core';
import { type Actor, type CommandResult, type GardenCommand, type GardenError, type GardenState, newGarden, runCommand } from '@garden/shared';
import { CURRENT_USER, asActor } from '../session/current-user';
import { isOffline, onStation, stationCall } from '../session/member-session';
import { loadJson, saveJson } from '../shared/storage';

/** Why a command didn't go through: the rules said no, or the station couldn't be reached. */
export type GardenFailure = GardenError | 'OFFLINE';

/** A command's answer. A refusal from the station still carries its latest state. */
export type GardenReply = { ok: true; state: GardenState; result: CommandResult } | { ok: false; error: GardenFailure; state?: GardenState };

export interface GardenLoad {
  state: GardenState;
  /** The station's clock minus this device's (growth, thirst and cooldowns run on the station's). */
  clockOffsetMs: number;
}

/** Who is playing on this page: everything they do is credited to them. */
export const LOCAL_PLAYER: Actor = asActor(CURRENT_USER);

/** The station's server answer for a command (see api/src/garden). */
type ServerReply = { version: number; state: GardenState; serverTime: string } & ({ ok: true; result: CommandResult } | { ok: false; error: GardenError });

/**
 * The station's shared garden. Signed in, it lives on the server: every change is a command
 * the server checks with the shared rules. Otherwise (the dev `?user=` stand-in, or behind the
 * start menu) a copy is kept on this device and the same rules run here.
 */
@Injectable({ providedIn: 'root' })
export class GardenService {
  private static readonly LOCAL_KEY = 'jardin-comunal:garden:v9';
  private readonly remote = onStation();

  async load(): Promise<GardenLoad> {
    if (!this.remote) return { state: this.localState(), clockOffsetMs: 0 };
    const sent = Date.now();
    const view = await stationCall<{ state: GardenState; serverTime: string }>('/garden');
    // The server's clock at the middle of the round trip, against ours.
    return { state: view.state, clockOffsetMs: Date.parse(view.serverTime) - (sent + Date.now()) / 2 };
  }

  /**
   * Ask the station to do something. The id is made once, so a retry after a dropped
   * connection can't do it twice: the station answers a repeated id from its records.
   */
  async run(command: GardenCommand): Promise<GardenReply> {
    if (!this.remote) return this.runLocally(command);
    const body = JSON.stringify({ id: crypto.randomUUID(), command });
    for (let attempt = 0; ; attempt++) {
      try {
        const reply = await stationCall<ServerReply>('/garden/commands', { method: 'POST', body });
        return reply.ok ? { ok: true, state: reply.state, result: reply.result } : { ok: false, error: reply.error, state: reply.state };
      } catch (e) {
        if (!isOffline(e)) throw e;
        if (attempt >= 1) return { ok: false, error: 'OFFLINE' };
      }
    }
  }

  private runLocally(command: GardenCommand): GardenReply {
    const outcome = runCommand(this.localState(), command, LOCAL_PLAYER, Date.now(), () => crypto.randomUUID());
    if (outcome.ok) saveJson(GardenService.LOCAL_KEY, outcome.state);
    return outcome;
  }

  private localState(): GardenState {
    const saved = loadJson<GardenState | null>(GardenService.LOCAL_KEY, null);
    if (saved) return saved;
    const fresh = newGarden('garden-demo', LOCAL_PLAYER, Date.now(), () => crypto.randomUUID());
    saveJson(GardenService.LOCAL_KEY, fresh);
    return fresh;
  }
}
