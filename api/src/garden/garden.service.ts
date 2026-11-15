import { type CommandReply, type GardenCommand, type GardenView, newGarden, runCommand, toActor } from '@garden/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, LessThan } from 'typeorm';
import type { MemberEntity } from '../members/member.entity';
import { GardenCommandEntity } from './garden-command.entity';
import { GardenEntity } from './garden.entity';

/** How long a command id is remembered: long enough for any retry. */
const COMMAND_MEMORY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GardenService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async view(me: MemberEntity): Promise<GardenView> {
    const where = { householdId: me.householdId };
    let garden = await this.db.manager.findOneBy(GardenEntity, where);
    if (!garden) {
      await this.plant(this.db.manager, me);
      garden = await this.db.manager.findOneByOrFail(GardenEntity, where);
    }
    // Forget old command ids while we're here (a load is rarer than a command, and off its hot path).
    await this.db.manager.delete(GardenCommandEntity, { ...where, createdAt: LessThan(new Date(Date.now() - COMMAND_MEMORY_MS)) });
    return viewOf(garden);
  }

  /**
   * Run one command for the caller's station, once. The station's row is locked for the length
   * of the transaction, so two players acting at once are applied one after the other.
   */
  async run(me: MemberEntity, commandId: string, cmd: GardenCommand): Promise<CommandReply> {
    return this.db.transaction(async (tx) => {
      const locked = () => tx.findOne(GardenEntity, { where: { householdId: me.householdId }, lock: { mode: 'pessimistic_write' } });
      let garden = await locked();
      if (!garden) {
        await this.plant(tx, me);
        garden = (await locked())!;
      }

      const seen = await tx.findOneBy(GardenCommandEntity, { id: commandId });
      if (seen) {
        if (seen.householdId !== me.householdId) throw new ConflictException('That command id was used by another station.');
        return { ...viewOf(garden), ...seen.outcome };
      }

      const { state, ...answer } = runCommand(garden.state, cmd, toActor(me), Date.now(), randomUUID);
      if (answer.ok) {
        await tx.update(GardenEntity, { householdId: me.householdId }, { state, version: () => '"version" + 1' });
        garden.state = state;
        garden.version++;
      }
      await tx.insert(GardenCommandEntity, { id: commandId, householdId: me.householdId, memberId: me.id, type: cmd.type, outcome: answer });
      return { ...viewOf(garden), ...answer };
    });
  }

  /** A station's first garden, credited to whoever opened it. Two first visits at once: the second keeps the first's. */
  private async plant(tx: EntityManager, me: MemberEntity): Promise<void> {
    const state = newGarden(me.householdId, toActor(me), Date.now(), randomUUID);
    await tx.createQueryBuilder().insert().into(GardenEntity).values({ householdId: me.householdId, state }).orIgnore().execute();
  }
}

const viewOf = (g: GardenEntity): GardenView => ({ version: g.version, state: g.state, serverTime: new Date().toISOString() });
