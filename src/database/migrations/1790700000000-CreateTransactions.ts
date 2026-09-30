import type { MigrationInterface, QueryRunner } from 'typeorm';

// Transactions and their portions (add-transactions, FR-06, FR-08, FR-14). Every transaction has at
// least one split: an income to Ready to Assign is a split without envelope, and deleting an
// envelope leaves its portions with envelope_id NULL ("Sin sobre"). Accounts are archived and payees
// soft-deleted, never removed, so their FKs take no cascade; deleting the plan removes everything.
export class CreateTransactions1790700000000 implements MigrationInterface {
  name = 'CreateTransactions1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "payee_id" uuid,
        "direction" character varying(7) NOT NULL,
        "amount_minor" bigint NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "description" character varying(120),
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_transactions_direction" CHECK ("direction" IN ('expense', 'income')),
        CONSTRAINT "CHK_transactions_amount" CHECK ("amount_minor" > 0),
        CONSTRAINT "FK_transactions_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts" ("id"),
        CONSTRAINT "FK_transactions_payee" FOREIGN KEY ("payee_id")
          REFERENCES "payees" ("id"),
        CONSTRAINT "FK_transactions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_plan_occurred"
        ON "transactions" ("plan_id", "occurred_at" DESC, "created_at" DESC)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_account" ON "transactions" ("account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_payee" ON "transactions" ("payee_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "transaction_splits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL,
        "envelope_id" uuid,
        "amount_minor" bigint NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_transaction_splits_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_transaction_splits_amount" CHECK ("amount_minor" > 0),
        CONSTRAINT "FK_transaction_splits_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transaction_splits_envelope" FOREIGN KEY ("envelope_id")
          REFERENCES "envelopes" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_splits_transaction"
        ON "transaction_splits" ("transaction_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_splits_envelope"
        ON "transaction_splits" ("envelope_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transaction_splits"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
  }
}
