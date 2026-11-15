import { type Actor, type CommandResult, type GardenCommand, type GardenError, type GardenState, newGarden, runCommand } from '@garden/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type { MemberEntity } from '../members/member.entity';
import { GardenCommandEntity } from './garden-command.entity';
import { GardenEntity } from './garden.entity';

/** The station's state as the client gets it: with its version and the server's clock (growth, thirst and caps run on it). */
export interface GardenView {
  version: number;
  state: GardenState;
  serverTime: string;
}

/** A command's answer, always with the latest state, so even a refused command brings the client up to date. */
export type CommandReply = GardenView & ({ ok: true; result: CommandResult } | { ok: false; error: GardenError });

const actorOf = (m: MemberEntity): Actor => ({ id: m.id, name: m.displayName });

@Injectable()
export class GardenService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async view(me: MemberEntity): Promise<GardenView> {
    const garden = (await this.db.manager.findOneBy(GardenEntity, { householdId: me.householdId })) ?? (await this.plant(this.db.manager, me));
    return this.viewOf(garden);
  }

  /**
   * Run one command for the caller's station, once. The station's row is locked for the length
   * of the transaction, so two players acting at once are applied one after the other.
   */
  async run(me: MemberEntity, commandId: string, cmd: GardenCommand): Promise<CommandReply> {
    return this.db.transaction(async (tx) => {
      if (!(await tx.existsBy(GardenEntity, { householdId: me.householdId }))) await this.plant(tx, me);
      const garden = await tx.findOneOrFail(GardenEntity, { where: { householdId: me.householdId }, lock: { mode: 'pessimistic_write' } });

      const seen = await tx.findOneBy(GardenCommandEntity, { id: commandId });
      if (seen) {
        if (seen.householdId !== me.householdId) throw new ConflictException('That command id was used by another station.');
        return { ...this.viewOf(garden), ...seen.outcome };
      }

      const outcome = runCommand(garden.state, cmd, actorOf(me), Date.now(), randomUUID);
      if (outcome.ok) {
        garden.state = outcome.state;
        await tx.save(garden); // bumps the version
      }
      const stored = outcome.ok ? { ok: true as const, result: outcome.result } : { ok: false as const, error: outcome.error };
      await tx.insert(GardenCommandEntity, { id: commandId, householdId: me.householdId, memberId: me.id, type: cmd.type, outcome: stored });
      return { ...this.viewOf(garden), ...stored };
    });
  }

  /** A station's first garden, credited to whoever opened it. Two first visits at once: the second one keeps the first's. */
  private async plant(tx: EntityManager, me: MemberEntity): Promise<GardenEntity> {
    const state = newGarden(me.householdId, actorOf(me), Date.now(), randomUUID);
    await tx.createQueryBuilder().insert().into(GardenEntity).values({ householdId: me.householdId, state }).orIgnore().execute();
    return tx.findOneByOrFail(GardenEntity, { householdId: me.householdId });
  }

  private viewOf(g: GardenEntity): GardenView {
    return { version: g.version, state: g.state, serverTime: new Date().toISOString() };
  }
}
