import { type HealthCommand, type HealthReply, type HealthView, emptyHealthRecord, runHealth, seedsOf, viewOfHealth } from '@garden/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { forgetOldCommands, lockOrCreate } from '../database/commands';
import { GardenService } from '../garden/garden.service';
import type { MemberEntity } from '../members/member.entity';
import { HealthCommandEntity } from './health-command.entity';
import { HealthRecordEntity } from './health-record.entity';

/**
 * Each member's private health record. Readings are only ever read for their owner; what the
 * station hears is the seeds they earned ("Mom earned 3 seeds"), never a value.
 */
@Injectable()
export class HealthRecordService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly gardens: GardenService,
  ) {}

  async view(me: MemberEntity): Promise<HealthView> {
    const row = await this.db.manager.findOneBy(HealthRecordEntity, { memberId: me.id });
    return viewOfHealth(row?.record ?? emptyHealthRecord());
  }

  /**
   * Run one command on the caller's record, once. The record's row is locked for the transaction,
   * and the garden's too when seeds are paid, so the record and the balance change together.
   */
  async run(me: MemberEntity, commandId: string, cmd: HealthCommand): Promise<HealthReply> {
    const reply = await this.db.transaction(async (tx): Promise<HealthReply> => {
      const row = await this.lock(tx, me);
      const seen = await tx.findOneBy(HealthCommandEntity, { id: commandId });
      if (seen) {
        if (seen.memberId !== me.id) throw new ConflictException('That command id was used by someone else.');
        // No garden: the first try's broadcast already brought every device up to date.
        return { result: seen.result, view: viewOfHealth(row.record) };
      }

      const { record, result } = runHealth(row.record, cmd, me, me.householdId, Date.now(), randomUUID);
      await tx.update(HealthRecordEntity, { memberId: me.id }, { record, version: () => '"version" + 1' });
      await tx.insert(HealthCommandEntity, { id: commandId, memberId: me.id, type: cmd.type, result });
      await forgetOldCommands(tx, HealthCommandEntity, { memberId: me.id });
      const paid = seedsOf(result);
      return { result, view: viewOfHealth(record), garden: paid > 0 ? await this.gardens.payReward(tx, me, paid) : undefined };
    });
    // Once committed: the station hears the seeds, not the readings.
    if (reply.garden) this.gardens.announce(me, reply.garden, { type: 'REWARD', amount: seedsOf(reply.result) });
    return reply;
  }

  /** The member's record row, locked until the transaction ends (created empty the first time). */
  private lock(tx: EntityManager, me: MemberEntity): Promise<HealthRecordEntity> {
    return lockOrCreate(tx, HealthRecordEntity, { memberId: me.id }, () =>
      tx.createQueryBuilder().insert().into(HealthRecordEntity).values({ memberId: me.id, record: emptyHealthRecord() }).orIgnore().execute(),
    );
  }
}
