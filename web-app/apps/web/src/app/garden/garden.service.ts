import { Injectable } from '@angular/core';
import {
  type Actor,
  type CommandReply,
  type CommandResult,
  type GardenCommand,
  type GardenError,
  type GardenState,
  type GardenView,
  newGarden,
  runCommand,
  toActor,
} from '@garden/shared';
import { CURRENT_USER } from '../session/current-user';
import { isOffline, onStation, stationCall } from '../session/member-session';
import { loadJson, saveJson } from '../shared/storage';

/** Why a command didn't go through: the rules said no, or the station couldn't be reached. */
export type GardenFailure = GardenError | 'OFFLINE';

/** A command's answer. A refusal from the station still carries its latest state (and, from the server, its version). */
export type GardenReply = { state?: GardenState; version?: number } & ({ ok: true; result: CommandResult } | { ok: false; error: GardenFailure });

/** A garden as loaded: the server's carries its version, a local copy has none. */
export interface LoadedGarden {
  state: GardenState;
  version?: number;
}

/** Who is playing on this page: everything they do is credited to them. */
export const LOCAL_PLAYER: Actor = toActor(CURRENT_USER);

/**
 * The station's shared garden. Signed in, it lives on the server: every change is a command
 * the server checks with the shared rules. Otherwise (the dev `?user=` stand-in, or behind the
 * start menu) a copy is kept on this device and the same rules run here.
 */
@Injectable({ providedIn: 'root' })
export class GardenService {
  private static readonly LOCAL_KEY = 'jardin-comunal:garden:v9';
  private readonly remote = onStation();
  /** The station's clock minus this device's, from the last answer (growth and cooldowns run on the station's). */
  private offsetMs = 0;

  /** Only the local copy can be reset (a station's garden is everyone's). */
  readonly canReset = !this.remote;

  /** Now, by the station's clock. */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  async load(): Promise<LoadedGarden> {
    if (!this.remote) return { state: this.localState() };
    return this.timed(() => stationCall<GardenView>('/garden'));
  }

  /** A live message carries the server's clock too. */
  heardFrom(serverTime: string): void {
    this.offsetMs = Date.parse(serverTime) - Date.now();
  }

  /**
   * Ask the station to do something. The id is made once, so the retry after a dropped
   * connection can't do it twice: the station answers a repeated id from its records.
   */
  async run(command: GardenCommand): Promise<GardenReply> {
    if (!this.remote) return this.runLocally(command);
    const body = JSON.stringify({ id: crypto.randomUUID(), command });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.timed(() => stationCall<CommandReply>('/garden/commands', { method: 'POST', body }));
      } catch (e) {
        if (!isOffline(e)) throw e;
      }
    }
    return { ok: false, error: 'OFFLINE' };
  }

  /** Demo: plant the starting garden again (the local copy only). */
  resetLocal(): void {
    saveJson(GardenService.LOCAL_KEY, null);
  }

  /** Every answer carries the server's clock: keep our offset from it current (taken at the round trip's middle). */
  private async timed<T extends { serverTime: string }>(request: () => Promise<T>): Promise<T> {
    const sent = Date.now();
    const reply = await request();
    this.offsetMs = Date.parse(reply.serverTime) - (sent + Date.now()) / 2;
    return reply;
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
