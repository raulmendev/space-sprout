import type { HealthRecord } from '@garden/shared';
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, type Relation, UpdateDateColumn, VersionColumn } from 'typeorm';
import { MemberEntity } from '../members/member.entity';

/** One member's health record: their readings, rewards, "don't know" answers and goals. Only ever read for its owner. */
@Entity('health_record')
export class HealthRecordEntity {
  @PrimaryColumn('text')
  memberId!: string;

  @OneToOne(() => MemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member!: Relation<MemberEntity>;

  @VersionColumn({ type: 'int' })
  version!: number;

  @Column('jsonb')
  record!: HealthRecord;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
