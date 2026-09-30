import type { MigrationInterface, QueryRunner } from 'typeorm';

// Facts only: no Available, Carryover or Ready to Assign column (FR-11).
// plan_id and envelope_id have no FK yet because their tables do not exist:
// add-plans-and-accounts adds FK_budget_months_plan and add-envelopes adds
// FK_assignments_envelope, both ON DELETE CASCADE.
export class CreateBudgetMonthsAndAssignments1790100000000 implements MigrationInterface {
  name = 'CreateBudgetMonthsAndAssignments1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budget_months" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "month" character(7) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_months_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_budget_months_plan_month" UNIQUE ("plan_id", "month"),
        CONSTRAINT "CHK_budget_months_month" CHECK ("month" ~ '^\\d{4}-(0[1-9]|1[0-2])$')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "budget_month_id" uuid NOT NULL,
        "envelope_id" uuid NOT NULL,
        "amount_minor" bigint NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assignments_month_envelope" UNIQUE ("budget_month_id", "envelope_id"),
        CONSTRAINT "FK_assignments_budget_month" FOREIGN KEY ("budget_month_id")
          REFERENCES "budget_months" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_envelope" ON "assignments" ("envelope_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assignments"`);
    await queryRunner.query(`DROP TABLE "budget_months"`);
  }
}
