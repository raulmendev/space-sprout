import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionController } from '../session/session.controller';
import { SessionEntity } from '../session/session.entity';
import { SessionGuard } from '../session/session.guard';
import { SessionService } from '../session/session.service';
import { MemberEntity } from './member.entity';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

/** Members and the sessions that say who is acting. The session guard covers every route; `@Public()` opts out. */
@Module({
  imports: [TypeOrmModule.forFeature([MemberEntity, SessionEntity])],
  controllers: [MembersController, SessionController],
  providers: [MembersService, SessionService, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class MembersModule {}
