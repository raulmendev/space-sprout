import type { DataSourceOptions } from 'typeorm';
import { GardenCommandEntity } from '../garden/garden-command.entity';
import { GardenEntity } from '../garden/garden.entity';
import { HouseholdEntity } from '../members/household.entity';
import { MemberEntity } from '../members/member.entity';
import { SessionEntity } from '../session/session.entity';
import { migrations } from './migrations';

/** One set of connection options for the Nest app and the TypeORM CLI. */
export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // Listed explicitly: the API is bundled, so TypeORM can't glob for files.
    entities: [HouseholdEntity, MemberEntity, SessionEntity, GardenEntity, GardenCommandEntity],
    migrations,
    // The schema only changes through migrations.
    synchronize: false,
    // UUID keys use gen_random_uuid() (pgcrypto) rather than uuid-ossp's uuid_generate_v4().
    uuidExtension: 'pgcrypto',
  };
}
