import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One station: a shared garden, balance and inventory for everyone in it. */
@Entity('household')
export class HouseholdEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  name!: string;

  /** What the family types to join this station (normalised: upper case, no separators). */
  @Index({ unique: true })
  @Column('text')
  stationKey!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
