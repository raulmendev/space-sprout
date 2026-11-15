import { MembersAndSessions1794762111617 } from './1794762111617-MembersAndSessions';
import { SeedDemoHousehold1794762111618 } from './1794762111618-SeedDemoHousehold';
import { Garden1794767100367 } from './1794767100367-Garden';
import { HealthRecord1794774720419 } from './1794774720419-HealthRecord';

/**
 * Every migration, in order. Add each new file from `npm run migration:generate`
 * (or `migration:create`) here: the bundled API can't glob for them.
 */
export const migrations: Function[] = [MembersAndSessions1794762111617, SeedDemoHousehold1794762111618, Garden1794767100367, HealthRecord1794774720419];
