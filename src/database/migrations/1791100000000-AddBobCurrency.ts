import type { MigrationInterface, QueryRunner } from 'typeorm';

// Fourth plan currency, BOB (add-bob-currency, FR-40): the check constraint of plans.currency_code
// is replaced so the database accepts it. Reverting refuses while a BOB plan exists, because the
// narrower constraint would be violated and a user's plan is never deleted silently.
export class AddBobCurrency1791100000000 implements MigrationInterface {
  name = 'AddBobCurrency1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "CHK_plans_currency_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "CHK_plans_currency_code" CHECK ("currency_code" IN ('ARS', 'USD', 'EUR', 'BOB'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { count: string }[] = await queryRunner.query(
      `SELECT count(*) AS "count" FROM "plans" WHERE "currency_code" = 'BOB'`,
    );
    const bobPlans = Number(rows[0]?.count ?? 0);
    if (bobPlans > 0) {
      throw new Error(
        `Cannot revert AddBobCurrency: ${bobPlans} plan(s) use BOB; delete or migrate them first.`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "CHK_plans_currency_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "CHK_plans_currency_code" CHECK ("currency_code" IN ('ARS', 'USD', 'EUR'))`,
    );
  }
}
