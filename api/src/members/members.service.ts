import { type Member, ROLE_COLORS, STATION_KEY_ALPHABET, STATION_KEY_LENGTH } from '@garden/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { HouseholdEntity } from './household.entity';
import { MemberEntity } from './member.entity';
import type { JoinInput, MemberChanges } from './members.schemas';

/** What the API sends for a member: the shared `Member`, nothing more. */
export const toMember = ({ id, householdId, displayName, role, suit, color }: Omit<MemberEntity, 'household' | 'createdAt'>): Member => ({
  id,
  householdId,
  displayName,
  role,
  suit,
  color,
});

const newStationKey = () => Array.from({ length: STATION_KEY_LENGTH }, () => STATION_KEY_ALPHABET[randomInt(STATION_KEY_ALPHABET.length)]).join('');

@Injectable()
export class MembersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
    private readonly sessions: SessionService,
  ) {}

  /**
   * A new player from the start menu: joins the station whose key they typed, or starts a
   * new one. The member and their session are created together.
   */
  async join(input: JoinInput): Promise<{ token: string; expiresAt: Date; member: Member; stationKey: string }> {
    return this.db.transaction(async (tx) => {
      const household = input.stationKey
        ? await tx.findOneBy(HouseholdEntity, { stationKey: input.stationKey })
        : await this.newHousehold(tx, `${input.displayName}'s station`);
      if (!household) throw new NotFoundException('No station has that key. Check it with whoever gave it to you.');
      const member = {
        id: randomUUID(),
        householdId: household.id,
        displayName: input.displayName,
        role: input.role,
        suit: input.suit,
        color: ROLE_COLORS[input.role],
      };
      await tx.insert(MemberEntity, member);
      const session = await this.sessions.start(member.id, tx);
      return { ...session, member: toMember(member), stationKey: household.stationKey };
    });
  }

  /** A new household with an unused key: a taken key is skipped (ON CONFLICT DO NOTHING) and another tried. */
  private async newHousehold(tx: EntityManager, name: string): Promise<HouseholdEntity> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const household = tx.create(HouseholdEntity, { id: randomUUID(), name, stationKey: newStationKey() });
      const result = await tx.createQueryBuilder().insert().into(HouseholdEntity).values(household).orIgnore().returning('id').execute();
      if ((result.raw as unknown[]).length) return household;
    }
    throw new Error('Could not find an unused station key.');
  }

  /** Everyone in a household, astronauts first. */
  async inHousehold(householdId: string): Promise<Member[]> {
    const rows = await this.members.find({ where: { householdId }, order: { role: 'ASC', createdAt: 'ASC' } });
    return rows.map(toMember);
  }

  async update(member: MemberEntity, changes: MemberChanges): Promise<Member> {
    await this.members.update({ id: member.id }, changes);
    return toMember({ ...member, ...changes });
  }
}
