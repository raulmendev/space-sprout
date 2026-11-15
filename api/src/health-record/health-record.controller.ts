import { Body, Controller, Get, Post } from '@nestjs/common';
import { MemberEntity } from '../members/member.entity';
import { CurrentMember } from '../session/session.guard';
import { type SendHealthCommand, SendHealthCommandSchema } from './health-record.schemas';
import { HealthRecordService } from './health-record.service';

/** The signed-in member's own health record. There is no way to read anyone else's. */
@Controller('health/me')
export class HealthRecordController {
  constructor(private readonly health: HealthRecordService) {}

  @Get()
  view(@CurrentMember() me: MemberEntity) {
    return this.health.view(me);
  }

  /** Readings, a "don't know", or a goal. Seeds earned go into the station's garden in the same transaction. */
  @Post('commands')
  run(@CurrentMember() me: MemberEntity, @Body({ schema: SendHealthCommandSchema }) body: SendHealthCommand) {
    return this.health.run(me, body.id, body.command);
  }
}
