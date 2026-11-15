import type { PresenceMember } from '@garden/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Subject } from 'rxjs';
import { type EntityManager, LessThan, MoreThan, Repository } from 'typeorm';
import { MemberEntity } from '../members/member.entity';
import { SessionEntity } from './session.entity';

/** How long a device stays signed in. */
const SESSION_DAYS = 30;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Start-menu sessions: a random bearer token per device. There's no password yet (real
 * auth comes later); the token just tells the server who is acting.
 */
@Injectable()
export class SessionService {
  /** The token hash of each session ended (signed out), for whoever holds it open (the live channel). */
  readonly ended = new Subject<string>();

  constructor(@InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>) {}

  /** A new token for a member, inside the caller's transaction. Also clears everyone's expired sessions. */
  async start(memberId: string, tx: EntityManager): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await tx.insert(SessionEntity, { tokenHash: hash(token), memberId, expiresAt });
    await tx.delete(SessionEntity, { expiresAt: LessThan(new Date()) });
    return { token, expiresAt };
  }

  /** The member behind a live token (with their household), or null. */
  async memberFor(token: string): Promise<MemberEntity | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hash(token), expiresAt: MoreThan(new Date()) },
      relations: { member: { household: true } },
    });
    return session?.member ?? null;
  }

  /** A live token's station, and what's needed to end the connection when the session ends (live channel). */
  async liveSessionFor(token: string): Promise<{ householdId: string; tokenHash: string; expiresAt: Date; member: PresenceMember } | null> {
    const session = await this.sessions.findOne({ where: { tokenHash: hash(token), expiresAt: MoreThan(new Date()) }, relations: { member: true } });
    if (!session) return null;
    const { member } = session;
    return { householdId: member.householdId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, member: { id: member.id, name: member.displayName, suit: member.suit } };
  }

  async end(token: string): Promise<void> {
    await this.sessions.delete({ tokenHash: hash(token) });
    this.ended.next(hash(token));
  }
}
