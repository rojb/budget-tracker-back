import type { MigrationInterface, QueryRunner } from 'typeorm';

// Transfers between two accounts of a plan (add-account-transfers, FR-28). No envelope, no payee:
// only the two account balances change. Accounts are never deleted, so the account FKs need no
// cascade.
export class CreateAccountTransfers1790500000000 implements MigrationInterface {
  name = 'CreateAccountTransfers1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "account_transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "from_account_id" uuid NOT NULL,
        "to_account_id" uuid NOT NULL,
        "amount_minor" bigint NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_transfers_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_account_transfers_amount" CHECK ("amount_minor" > 0),
        CONSTRAINT "CHK_account_transfers_accounts" CHECK ("from_account_id" <> "to_account_id"),
        CONSTRAINT "FK_account_transfers_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_account_transfers_from" FOREIGN KEY ("from_account_id")
          REFERENCES "accounts" ("id"),
        CONSTRAINT "FK_account_transfers_to" FOREIGN KEY ("to_account_id")
          REFERENCES "accounts" ("id"),
        CONSTRAINT "FK_account_transfers_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_account_transfers_from" ON "account_transfers" ("from_account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_account_transfers_to" ON "account_transfers" ("to_account_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "account_transfers"`);
  }
}
