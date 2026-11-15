import { Body, Controller, Patch } from '@nestjs/common';
import { CurrentMember } from '../session/session.guard';
import { MemberEntity } from './member.entity';
import { type MemberChanges, MemberChangesSchema } from './members.schemas';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  /** Change your own name, role, suit or colour (the start menu's "Change player"). */
  @Patch('me')
  update(@CurrentMember() me: MemberEntity, @Body({ schema: MemberChangesSchema }) body: MemberChanges) {
    return this.members.update(me, body);
  }
}
