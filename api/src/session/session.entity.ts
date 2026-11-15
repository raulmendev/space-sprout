import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MemberEntity } from '../members/member.entity';

/** A signed-in device. Only the token's SHA-256 is stored, so a database leak can't be replayed. */
@Entity('session')
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column('text')
  tokenHash!: string;

  @Index()
  @Column('text')
  memberId!: string;

  @ManyToOne(() => MemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member!: Relation<MemberEntity>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column('timestamptz')
  expiresAt!: Date;
}
