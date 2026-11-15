import type { GardenState } from '@garden/shared';
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, type Relation, UpdateDateColumn, VersionColumn } from 'typeorm';
import { HouseholdEntity } from '../members/household.entity';

/** A station's whole shared state, one row per station, changed only by garden commands. */
@Entity('garden')
export class GardenEntity {
  @PrimaryColumn('text')
  householdId!: string;

  @OneToOne(() => HouseholdEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household!: Relation<HouseholdEntity>;

  /** Goes up by one with every change, so a client can tell it missed something. */
  @VersionColumn({ type: 'int' })
  version!: number;

  @Column('jsonb')
  state!: GardenState;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
