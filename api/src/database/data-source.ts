/** Data source for the TypeORM CLI (`npm run migration:*`), run through tsx with `.env` loaded by Node. */
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env';
import { dataSourceOptions } from './options';

const env = validateEnv(process.env);

export default new DataSource(dataSourceOptions(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL));
