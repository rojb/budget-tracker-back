import type { MigrationInterface, QueryRunner } from 'typeorm';

// Payees of a plan (add-payees). Deleted logically (deleted_at) so past transactions keep them
// (FR-05). Names are unique per plan among active payees, ignoring case.
// suggested_envelope_id has no FK yet: add-envelopes adds FK_payees_suggested_envelope
// (ON DELETE SET NULL).
export class CreatePayees1790300000000 implements MigrationInterface {
  name = 'CreatePayees1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "name" character varying(60) NOT NULL,
        "suggested_envelope_id" uuid,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payees_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payees_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payees_plan_name_active"
        ON "payees" ("plan_id", lower("name")) WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payees"`);
  }
}
