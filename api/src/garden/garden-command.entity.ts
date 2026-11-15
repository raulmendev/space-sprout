import type { CommandResult, GardenError } from '@garden/shared';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { HouseholdEntity } from '../members/household.entity';

/** What a command answered, kept so a retry with the same id gets the same answer instead of running twice. */
export type StoredOutcome = { ok: true; result: CommandResult } | { ok: false; error: GardenError };

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

  @Column('jsonb')
  outcome!: StoredOutcome;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
