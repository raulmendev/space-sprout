import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './catalog/catalog.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { GardenModule } from './garden/garden.module';
import { HealthModule } from './health/health.module';
import { HealthRecordModule } from './health-record/health-record.module';
import { MembersModule } from './members/members.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    HealthModule,
    CatalogModule,
    MembersModule,
    GardenModule,
    HealthRecordModule,
  ],
})
export class AppModule {}
