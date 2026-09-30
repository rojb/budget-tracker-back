import type { MigrationInterface, QueryRunner } from 'typeorm';

// Envelope groups and envelopes of a plan (add-envelopes, FR-04). Names are unique per plan among
// groups and among envelopes, ignoring case. Deleting a group keeps its envelopes (group_id is set
// to NULL, "Sin grupo"). The same migration adds the two foreign keys that were waiting for this
// table: FK_assignments_envelope (announced by add-budget-calc-engine) and
// FK_payees_suggested_envelope (announced by add-payees).
export class CreateEnvelopes1790600000000 implements MigrationInterface {
  name = 'CreateEnvelopes1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "envelope_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "name" character varying(60) NOT NULL,
        "position" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_envelope_groups_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_envelope_groups_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_envelope_groups_plan_name"
        ON "envelope_groups" ("plan_id", lower("name"))
    `);
    await queryRunner.query(`
      CREATE TABLE "envelopes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "group_id" uuid,
        "name" character varying(60) NOT NULL,
        "icon" character varying(16) NOT NULL DEFAULT 'tag',
        "position" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_envelopes_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_envelopes_icon" CHECK ("icon" IN (
          'tag', 'home', 'bus', 'utensils', 'heartPulse', 'gift', 'cart', 'pill', 'wifi',
          'settings', 'ticket', 'repeat', 'lifeBuoy', 'plane'
        )),
        CONSTRAINT "FK_envelopes_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_envelopes_group" FOREIGN KEY ("group_id")
          REFERENCES "envelope_groups" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_envelopes_plan_name" ON "envelopes" ("plan_id", lower("name"))
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_envelopes_plan_group_position"
        ON "envelopes" ("plan_id", "group_id", "position")
    `);
    await queryRunner.query(`
      ALTER TABLE "assignments" ADD CONSTRAINT "FK_assignments_envelope"
        FOREIGN KEY ("envelope_id") REFERENCES "envelopes" ("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "payees" ADD CONSTRAINT "FK_payees_suggested_envelope"
        FOREIGN KEY ("suggested_envelope_id") REFERENCES "envelopes" ("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payees" DROP CONSTRAINT "FK_payees_suggested_envelope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP CONSTRAINT "FK_assignments_envelope"`,
    );
    await queryRunner.query(`DROP TABLE "envelopes"`);
    await queryRunner.query(`DROP TABLE "envelope_groups"`);
  }
}
