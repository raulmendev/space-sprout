import { MigrationInterface, QueryRunner } from "typeorm";

export class HealthRecord1794774720419 implements MigrationInterface {
    name = 'HealthRecord1794774720419'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "health_command" ("id" uuid NOT NULL, "memberId" text NOT NULL, "type" text NOT NULL, "result" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4d3558b6be054daf88735f39da7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a35881d6eeb2a665856e0ce07f" ON "health_command"  ("memberId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "health_record" ("memberId" text NOT NULL, "version" integer NOT NULL, "record" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_164fa256c4ddf484e68e723a08a" PRIMARY KEY ("memberId"))`);
        await queryRunner.query(`ALTER TABLE "health_command" ADD CONSTRAINT "FK_f3e5a7437afcd25f8536bcf0885" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "health_record" ADD CONSTRAINT "FK_164fa256c4ddf484e68e723a08a" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "health_record" DROP CONSTRAINT "FK_164fa256c4ddf484e68e723a08a"`);
        await queryRunner.query(`ALTER TABLE "health_command" DROP CONSTRAINT "FK_f3e5a7437afcd25f8536bcf0885"`);
        await queryRunner.query(`DROP TABLE "health_record"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a35881d6eeb2a665856e0ce07f"`);
        await queryRunner.query(`DROP TABLE "health_command"`);
    }

}
