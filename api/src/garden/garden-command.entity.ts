import type { CommandAnswer } from '@garden/shared';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { HouseholdEntity } from '../members/household.entity';

/** One command a player sent, by the id their device gave it. */
@Entity('garden_command')
@Index(['householdId', 'createdAt'])
export class GardenCommandEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  householdId!: string;

  @ManyToOne(() => HouseholdEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household!: Relation<HouseholdEntity>;

  @Column('text')
  memberId!: string;

  @Column('text')
  type!: string;

  /** What it answered, so a retry with the same id gets the same answer instead of running twice. */
  @Column('jsonb')
  outcome!: CommandAnswer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
