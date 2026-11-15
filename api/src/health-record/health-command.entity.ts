import type { HealthResult } from '@garden/shared';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { MemberEntity } from '../members/member.entity';

/** One health command a member sent, by the id their device gave it, so a retry can't pay twice. */
@Entity('health_command')
@Index(['memberId', 'createdAt'])
export class HealthCommandEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  memberId!: string;

  @ManyToOne(() => MemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member!: Relation<MemberEntity>;

  @Column('text')
  type!: string;

  /** What it answered, for a retry with the same id. */
  @Column('jsonb')
  result!: HealthResult;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
