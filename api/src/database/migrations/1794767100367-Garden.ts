import { MigrationInterface, QueryRunner } from "typeorm";

export class Garden1794767100367 implements MigrationInterface {
    name = 'Garden1794767100367'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "garden_command" ("id" uuid NOT NULL, "householdId" text NOT NULL, "memberId" text NOT NULL, "type" text NOT NULL, "outcome" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a5fcb0084dc0016f35c90765af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e989645210bc319a71995286bc" ON "garden_command"  ("householdId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "garden" ("householdId" text NOT NULL, "version" integer NOT NULL, "state" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5d2711ee64f3a98c39eb5832eb8" PRIMARY KEY ("householdId"))`);
        await queryRunner.query(`ALTER TABLE "garden_command" ADD CONSTRAINT "FK_96e75b9b6a8989a4637154fccb8" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "garden" ADD CONSTRAINT "FK_5d2711ee64f3a98c39eb5832eb8" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "garden" DROP CONSTRAINT "FK_5d2711ee64f3a98c39eb5832eb8"`);
        await queryRunner.query(`ALTER TABLE "garden_command" DROP CONSTRAINT "FK_96e75b9b6a8989a4637154fccb8"`);
        await queryRunner.query(`DROP TABLE "garden"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e989645210bc319a71995286bc"`);
        await queryRunner.query(`DROP TABLE "garden_command"`);
    }

}
