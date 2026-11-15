import { MembersAndSessions1794762111617 } from './1794762111617-MembersAndSessions';
import { SeedDemoHousehold1794762111618 } from './1794762111618-SeedDemoHousehold';

/**
 * Every migration, in order. Add each new file from `npm run migration:generate`
 * (or `migration:create`) here: the bundled API can't glob for them.
 */
export const migrations: Function[] = [MembersAndSessions1794762111617, SeedDemoHousehold1794762111618];
