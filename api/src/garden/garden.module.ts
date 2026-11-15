import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { GardenController } from './garden.controller';
import { GardenService } from './garden.service';

@Module({ imports: [LiveModule], controllers: [GardenController], providers: [GardenService], exports: [GardenService] })
export class GardenModule {}
