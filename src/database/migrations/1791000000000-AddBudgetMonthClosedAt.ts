import type { MigrationInterface, QueryRunner } from 'typeorm';

// Month close confirmation (add-monthly-assignment, screen 25): when the close of a month was
// confirmed. It records only that the close was seen; every figure stays derived (FR-11, FR-12).
// Reverting forgets the confirmations, so 25 opens again.
export class AddBudgetMonthClosedAt1791000000000 implements MigrationInterface {
  name = 'AddBudgetMonthClosedAt1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budget_months" ADD COLUMN "closed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budget_months" DROP COLUMN "closed_at"`,
    );
  }
}
