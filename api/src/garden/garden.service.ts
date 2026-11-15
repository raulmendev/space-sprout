import { type CommandReply, type GardenCommand, type GardenState, type GardenView, newGarden, runCommand, toActor } from '@garden/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { forgetOldCommands, lockOrCreate } from '../database/commands';
import { LiveService } from '../live/live.service';
import type { MemberEntity } from '../members/member.entity';
import { GardenCommandEntity } from './garden-command.entity';
import { GardenEntity } from './garden.entity';

@Injectable()
export class GardenService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly live: LiveService,
  ) {}

  async view(me: MemberEntity): Promise<GardenView> {
    const where = { householdId: me.householdId };
    let garden = await this.db.manager.findOneBy(GardenEntity, where);
    if (!garden) {
      await this.plant(this.db.manager, me);
      garden = await this.db.manager.findOneByOrFail(GardenEntity, where);
    }
    // Forget old command ids while we're here (a load is rarer than a command, and off its hot path).
    await forgetOldCommands(this.db.manager, GardenCommandEntity, where);
    return viewOf(garden);
  }

  /**
   * Run one command for the caller's station, once. The station's row is locked for the length
   * of the transaction, so two players acting at once are applied one after the other.
   */
  async run(me: MemberEntity, commandId: string, cmd: GardenCommand): Promise<CommandReply> {
    const { reply, changed } = await this.apply(me, commandId, cmd);
    // Only once it's committed: tell everyone in the station (the sender too, on their other devices).
    if (changed) this.announce(me, reply, cmd);
    return reply;
  }

  /**
   * Pay the seeds a health check-in earned, inside the caller's transaction, so the member's record
   * and the station's balance change together. Announce the returned garden once that commits.
   */
  async payReward(tx: EntityManager, me: MemberEntity, amount: number): Promise<GardenView> {
    const garden = await this.lock(tx, me);
    await this.save(tx, garden, runCommand(garden.state, { type: 'REWARD', amount }, toActor(me), Date.now(), randomUUID).state);
    return viewOf(garden);
  }

  /** Tell everyone in the station about a committed change (the sender too, on their other devices). */
  announce(me: MemberEntity, view: GardenView, command: GardenCommand): void {
    this.live.broadcast(me.householdId, { type: 'GARDEN', version: view.version, state: view.state, serverTime: view.serverTime, by: toActor(me), command });
  }

  private async apply(me: MemberEntity, commandId: string, cmd: GardenCommand): Promise<{ reply: CommandReply; changed: boolean }> {
    return this.db.transaction(async (tx) => {
      const garden = await this.lock(tx, me);

      const seen = await tx.findOneBy(GardenCommandEntity, { id: commandId });
      if (seen) {
        if (seen.householdId !== me.householdId) throw new ConflictException('That command id was used by another station.');
        return { reply: { ...viewOf(garden), ...seen.outcome }, changed: false };
      }

      const { state, ...answer } = runCommand(garden.state, cmd, toActor(me), Date.now(), randomUUID);
      if (answer.ok) await this.save(tx, garden, state);
      await tx.insert(GardenCommandEntity, { id: commandId, householdId: me.householdId, memberId: me.id, type: cmd.type, outcome: answer });
      return { reply: { ...viewOf(garden), ...answer }, changed: answer.ok };
    });
  }

  /** The station's garden row, locked until the transaction ends (planted first if the station has none yet). */
  private lock(tx: EntityManager, me: MemberEntity): Promise<GardenEntity> {
    return lockOrCreate(tx, GardenEntity, { householdId: me.householdId }, () => this.plant(tx, me));
  }

  /** Store a locked garden's new state, one version up. */
  private async save(tx: EntityManager, garden: GardenEntity, state: GardenState): Promise<void> {
    await tx.update(GardenEntity, { householdId: garden.householdId }, { state, version: () => '"version" + 1' });
    garden.state = state;
    garden.version++;
  }

  /** A station's first garden, credited to whoever opened it. Two first visits at once: the second keeps the first's. */
  private async plant(tx: EntityManager, me: MemberEntity): Promise<void> {
    const state = newGarden(me.householdId, toActor(me), Date.now(), randomUUID);
    await tx.createQueryBuilder().insert().into(GardenEntity).values({ householdId: me.householdId, state }).orIgnore().execute();
  }
}

const viewOf = (g: GardenEntity): GardenView => ({ version: g.version, state: g.state, serverTime: new Date().toISOString() });
