import type { MigrationInterface, QueryRunner } from 'typeorm';

// Logical deletion of transactions (add-transaction-editing-and-filters, FR-13): a deleted
// transaction keeps its row and portions so it can be restored exactly, and every reader of the
// facts ignores rows with a deleted_at. Reverting makes deleted transactions count again.
export class AddTransactionDeletedAt1790800000000 implements MigrationInterface {
  name = 'AddTransactionDeletedAt1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "deleted_at"`,
    );
  }
}
