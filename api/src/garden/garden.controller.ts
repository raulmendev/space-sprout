import { Body, Controller, Get, Post } from '@nestjs/common';
import { MemberEntity } from '../members/member.entity';
import { CurrentMember } from '../session/session.guard';
import { type SendCommand, SendCommandSchema } from './garden.schemas';
import { GardenService } from './garden.service';

/** The station's shared garden: read it, and change it one command at a time. */
@Controller('garden')
export class GardenController {
  constructor(private readonly garden: GardenService) {}

  @Get()
  view(@CurrentMember() me: MemberEntity) {
    return this.garden.view(me);
  }

  /** 201 with `ok: false` when the rules refuse it (the client shows why); the latest state comes back either way. */
  @Post('commands')
  run(@CurrentMember() me: MemberEntity, @Body({ schema: SendCommandSchema }) body: SendCommand) {
    return this.garden.run(me, body.id, body.command);
  }
}
