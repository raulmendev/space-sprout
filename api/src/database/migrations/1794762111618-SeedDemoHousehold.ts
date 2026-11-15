import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The demo household (station key GARDEN): the astronaut and one family member, with the ids the web app's
 * local demo users already had. Values are written out (not imported from @garden/shared)
 * so this migration never changes after it has run.
 */
export class SeedDemoHousehold1794762111618 implements MigrationInterface {
  name = 'SeedDemoHousehold1794762111618';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "household" ("id", "name", "stationKey") VALUES ('demo-household', 'Demo station', 'GARDEN')`);
    await queryRunner.query(
      `INSERT INTO "member" ("id", "householdId", "displayName", "role", "suit", "color") VALUES
        ('astronaut-demo', 'demo-household', 'Astronaut', 'ASTRONAUT', 'turquoise', '#a9dcf2'),
        ('family-demo', 'demo-household', 'Family', 'FAMILY', 'green', '#ffe27a')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "household" WHERE "id" = 'demo-household'`);
  }
}
