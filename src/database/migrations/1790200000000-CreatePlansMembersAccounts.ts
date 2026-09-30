import type { MigrationInterface, QueryRunner } from 'typeorm';

// Plans, their members and accounts (add-plans-and-accounts). No balance column: account
// balances are derived (FR-03). Also adds the FK that add-budget-calc-engine left pending on
// budget_months.plan_id.
export class CreatePlansMembersAccounts1790200000000 implements MigrationInterface {
  name = 'CreatePlansMembersAccounts1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(60) NOT NULL,
        "currency_code" character(3) NOT NULL,
        "time_zone" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_plans_currency_code" CHECK ("currency_code" IN ('ARS', 'USD', 'EUR'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "plan_members" (
        "plan_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying(10) NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_members" PRIMARY KEY ("plan_id", "user_id"),
        CONSTRAINT "CHK_plan_members_role" CHECK ("role" IN ('owner', 'editor', 'viewer')),
        CONSTRAINT "FK_plan_members_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_members_user" ON "plan_members" ("user_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "name" character varying(60) NOT NULL,
        "type" character varying(16) NOT NULL,
        "opening_balance_minor" bigint NOT NULL,
        "archived_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_accounts_type" CHECK ("type" IN ('bank', 'digitalWallet', 'cash')),
        CONSTRAINT "FK_accounts_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_accounts_plan" ON "accounts" ("plan_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "budget_months" ADD CONSTRAINT "FK_budget_months_plan"
        FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budget_months" DROP CONSTRAINT "FK_budget_months_plan"`,
    );
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TABLE "plan_members"`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
