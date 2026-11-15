import { type Suit, USER_ROLES, type UserRole } from '@garden/shared';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { HouseholdEntity } from './household.entity';

const oneOf = (column: string, values: readonly string[]) => `"${column}" IN (${values.map((v) => `'${v}'`).join(', ')})`;

/**
 * A person in a household. The suit isn't checked by the database (new suits arrive with new art;
 * the API validates them against SUITS). Columns carry explicit types (the migration CLI runs without decorator
 * metadata), and relations use `Relation<>` (the bundle would otherwise hit a circular import).
 */
@Entity('member')
@Check('member_role_check', oneOf('role', USER_ROLES))
@Check('member_color_check', `"color" ~ '^#[0-9a-fA-F]{6}$'`)
export class MemberEntity {
  /** Text, not uuid: the seeded demo members keep the ids the local saves already use. */
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column('text')
  householdId!: string;

  @ManyToOne(() => HouseholdEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household!: Relation<HouseholdEntity>;

  @Column('text')
  displayName!: string;

  @Column('text')
  role!: UserRole;

  @Column('text')
  suit!: Suit;

  @Column('text')
  color!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
