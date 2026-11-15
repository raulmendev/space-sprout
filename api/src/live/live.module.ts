import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module';
import { LiveService } from './live.service';

@Module({ imports: [MembersModule], providers: [LiveService], exports: [LiveService] })
export class LiveModule {}
