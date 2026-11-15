import type { DataSourceOptions } from 'typeorm';
import { migrations } from './migrations';

/** One set of connection options for the Nest app and the TypeORM CLI. */
export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // Listed explicitly: the API is bundled, so TypeORM can't glob for files.
    entities: [],
    migrations,
    // The schema only changes through migrations.
    synchronize: false,
    // UUID keys use gen_random_uuid() (pgcrypto) rather than uuid-ossp's uuid_generate_v4().
    uuidExtension: 'pgcrypto',
  };
}
