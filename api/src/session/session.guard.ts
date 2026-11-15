import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { MemberEntity } from '../members/member.entity';
import { SessionService } from './session.service';

interface SignedInRequest extends Request {
  member?: MemberEntity;
  token?: string;
}

const IS_PUBLIC = 'isPublic';
/** Opens a route (or a whole controller) to callers without a session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

const bearer = (req: Request): string | undefined => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
};

/**
 * Registered for every route: lets a request through only with a live session token
 * (`Authorization: Bearer <token>`), unless the route is `@Public()`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<SignedInRequest>();
    const token = bearer(req);
    const member = token && (await this.sessions.memberFor(token));
    if (!member) throw new UnauthorizedException('Sign in from the start menu first.');
    req.member = member;
    req.token = token;
    return true;
  }
}

/** The signed-in member, with their household loaded. */
export const CurrentMember = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<SignedInRequest>().member!,
);

/** The request's session token. */
export const SessionToken = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<SignedInRequest>().token!,
);
