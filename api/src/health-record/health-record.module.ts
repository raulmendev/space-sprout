import { Module } from '@nestjs/common';
import { GardenModule } from '../garden/garden.module';
import { HealthRecordController } from './health-record.controller';
import { HealthRecordService } from './health-record.service';

@Module({ imports: [GardenModule], controllers: [HealthRecordController], providers: [HealthRecordService] })
export class HealthRecordModule {}
