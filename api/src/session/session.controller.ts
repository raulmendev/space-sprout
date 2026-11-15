import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { MemberEntity } from '../members/member.entity';
import { type JoinInput, JoinSchema } from '../members/members.schemas';
import { MembersService, toMember } from '../members/members.service';
import { CurrentMember, Public, SessionToken } from './session.guard';
import { SessionService } from './session.service';

@Controller()
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly members: MembersService,
  ) {}

  /** The start menu: become a new member (of a new station, or of the one the key names) and sign in. */
  @Public()
  @Post('join')
  join(@Body({ schema: JoinSchema }) body: JoinInput) {
    return this.members.join(body);
  }

  /** Everything the game needs at boot: who you are, your station's key and everyone in it. */
  @Get('session')
  async current(@CurrentMember() me: MemberEntity) {
    return { member: toMember(me), stationKey: me.household.stationKey, members: await this.members.inHousehold(me.householdId) };
  }

  /** Sign this device out. */
  @Delete('session')
  @HttpCode(204)
  end(@SessionToken() token: string) {
    return this.sessions.end(token);
  }
}
