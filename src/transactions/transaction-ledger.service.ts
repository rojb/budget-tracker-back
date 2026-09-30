import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  EnvelopeAmount,
  LedgerAmount,
} from '../budget/calculation.types.js';
import type { MonthKey } from '../budget/month-key.js';

// Signed amount of a transaction on its account: income +, expense −.
const SIGNED = `CASE t.direction WHEN 'income' THEN t.amount_minor ELSE -t.amount_minor END`;

// Read side of the transactions: the facts the budget engine, the account balances and the payee
// counts derive their figures from. It owns the sign and the month rules so they live in one place,
// and it depends on nothing but the database, so the accounts, envelopes and payees modules can use
// it without a cycle. Months are computed in SQL in the plan's time zone with the same expression
// `AccountsService` already uses for transfers, and rows are grouped there: the engine receives one
// row per envelope and month, not one per transaction.
@Injectable()
export class TransactionLedgerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Σ of the signed transaction amounts of every account of the plan.
  async netByAccount(planId: string): Promise<Map<string, number>> {
    const rows: { accountId: string; net: string }[] =
      await this.dataSource.query(
        `SELECT t.account_id AS "accountId", SUM(${SIGNED})::text AS net
           FROM transactions t WHERE t.plan_id = $1 GROUP BY t.account_id`,
        [planId],
      );
    return new Map(rows.map((row) => [row.accountId, Number(row.net)]));
  }

  // Money that entered (income) and left (expense) the account in the month of the plan's time zone.
  async monthlyFlows(
    accountId: string,
    month: MonthKey,
  ): Promise<{ inflowMinor: number; outflowMinor: number }> {
    const [row]: { inflow: string; outflow: string }[] =
      await this.dataSource.query(
        `SELECT
           COALESCE(SUM(t.amount_minor) FILTER (WHERE t.direction = 'income'), 0)::text AS inflow,
           COALESCE(SUM(t.amount_minor) FILTER (WHERE t.direction = 'expense'), 0)::text AS outflow
         FROM transactions t JOIN plans p ON p.id = t.plan_id
         WHERE t.account_id = $1
           AND to_char(t.occurred_at AT TIME ZONE p.time_zone, 'YYYY-MM') = $2`,
        [accountId, month],
      );
    return {
      inflowMinor: Number(row.inflow),
      outflowMinor: Number(row.outflow),
    };
  }

  // Changes to the sum of balances, by month, for the accounts in `accountIds` (the active ones).
  async balanceMovements(
    planId: string,
    timeZone: string,
    accountIds: string[],
  ): Promise<LedgerAmount[]> {
    if (accountIds.length === 0) {
      return [];
    }
    const rows: { month: MonthKey; amount: string }[] =
      await this.dataSource.query(
        `SELECT to_char(t.occurred_at AT TIME ZONE $2, 'YYYY-MM') AS month,
                SUM(${SIGNED})::text AS amount
           FROM transactions t
          WHERE t.plan_id = $1 AND t.account_id = ANY($3::uuid[])
          GROUP BY 1`,
        [planId, timeZone, accountIds],
      );
    return rows.map((row) => ({
      month: row.month,
      amountMinor: Number(row.amount),
    }));
  }

  // Net outflow per envelope and month: expense portion +, income portion −. A portion without an
  // envelope (income to Ready to Assign, or an envelope that was deleted) is activity of no envelope.
  async spending(planId: string, timeZone: string): Promise<EnvelopeAmount[]> {
    const rows: { envelopeId: string; month: MonthKey; amount: string }[] =
      await this.dataSource.query(
        `SELECT s.envelope_id AS "envelopeId",
                to_char(t.occurred_at AT TIME ZONE $2, 'YYYY-MM') AS month,
                SUM(CASE t.direction WHEN 'expense' THEN s.amount_minor ELSE -s.amount_minor END)::text AS amount
           FROM transaction_splits s JOIN transactions t ON t.id = s.transaction_id
          WHERE t.plan_id = $1 AND s.envelope_id IS NOT NULL
          GROUP BY 1, 2`,
        [planId, timeZone],
      );
    return rows.map((row) => ({
      envelopeId: row.envelopeId,
      month: row.month,
      amountMinor: Number(row.amount),
    }));
  }

  // Transactions per payee, deleted payees included (their past transactions keep the reference).
  async payeeCounts(planId: string): Promise<Map<string, number>> {
    const rows: { payeeId: string; total: string }[] =
      await this.dataSource.query(
        `SELECT t.payee_id AS "payeeId", COUNT(*)::text AS total
           FROM transactions t
          WHERE t.plan_id = $1 AND t.payee_id IS NOT NULL
          GROUP BY t.payee_id`,
        [planId],
      );
    return new Map(rows.map((row) => [row.payeeId, Number(row.total)]));
  }
}
