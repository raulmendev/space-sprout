import { MigrationInterface, QueryRunner } from "typeorm";

export class MembersAndSessions1794762111617 implements MigrationInterface {
    name = 'MembersAndSessions1794762111617'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "member" ("id" text NOT NULL, "householdId" text NOT NULL, "displayName" text NOT NULL, "role" text NOT NULL, "suit" text NOT NULL, "color" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "member_color_check" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$'), CONSTRAINT "member_suit_check" CHECK ("suit" IN ('turquoise', 'green', 'black', 'wine')), CONSTRAINT "member_role_check" CHECK ("role" IN ('ASTRONAUT', 'FAMILY')), CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9d8aee1ad649ba2f7731f24dc7" ON "member"  ("householdId") `);
        await queryRunner.query(`CREATE TABLE "household" ("id" text NOT NULL, "name" text NOT NULL, "stationKey" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_26e9111eab2b8908fefe3c645f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_adce3445f89c651d3bce67fca2" ON "household"  ("stationKey") `);
        await queryRunner.query(`CREATE TABLE "session" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tokenHash" text NOT NULL, "memberId" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ff3b5bfd0767bd32942e5ccaad" ON "session"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f8d57f74fb4486a743d89d482" ON "session"  ("memberId") `);
        await queryRunner.query(`ALTER TABLE "member" ADD CONSTRAINT "FK_9d8aee1ad649ba2f7731f24dc7a" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "FK_1f8d57f74fb4486a743d89d4820" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_1f8d57f74fb4486a743d89d4820"`);
        await queryRunner.query(`ALTER TABLE "member" DROP CONSTRAINT "FK_9d8aee1ad649ba2f7731f24dc7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f8d57f74fb4486a743d89d482"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff3b5bfd0767bd32942e5ccaad"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_adce3445f89c651d3bce67fca2"`);
        await queryRunner.query(`DROP TABLE "household"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d8aee1ad649ba2f7731f24dc7"`);
        await queryRunner.query(`DROP TABLE "member"`);
    }

}
