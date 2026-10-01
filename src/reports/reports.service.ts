import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import {
  addMonths,
  compareMonths,
  currentMonth,
  monthRange,
  type MonthKey,
} from '../budget/month-key.js';
import { EnvelopesService } from '../envelopes/envelopes.service.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { TransactionLedgerService } from '../transactions/transaction-ledger.service.js';
import {
  EnvelopeSpendingDto,
  IncomeExpenseMonthDto,
  IncomeExpenseReportDto,
  NetWorthMonthDto,
  NetWorthReportDto,
  SpendingMonthDto,
  SpendingReportDto,
  type ReportRangeQueryDto,
} from './dto/report.dto.js';

const MAX_MONTHS = 24;

interface Range {
  plan: Plan;
  from: MonthKey;
  to: MonthKey;
  months: MonthKey[];
}

// Reports (add-reports, FR-26). Read-only: every figure comes from the read side other modules
// already own (the transaction ledger, the account ledger, the envelope list), attributed to budget
// months in the plan's time zone like the rest of the app. Callers check membership first.
@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    private readonly ledger: TransactionLedgerService,
    private readonly accounts: AccountsService,
    private readonly envelopes: EnvelopesService,
  ) {}

  async spending(
    planId: string,
    query: ReportRangeQueryDto,
  ): Promise<SpendingReportDto> {
    const range = await this.range(planId, query);
    const [rows, list] = await Promise.all([
      this.ledger.spending(planId, range.plan.timeZone),
      this.envelopes.list(planId),
    ]);
    const envelopes = new Map(
      list.items.map((line) => [line.envelope.id, line.envelope]),
    );
    const byMonth = new Map<MonthKey, EnvelopeSpendingDto[]>();
    for (const row of rows) {
      const envelope = envelopes.get(row.envelopeId);
      if (row.amountMinor <= 0 || !envelope) continue;
      const entry = Object.assign(new EnvelopeSpendingDto(), {
        envelopeId: row.envelopeId,
        name: envelope.name,
        icon: envelope.icon,
        amountMinor: row.amountMinor,
      });
      byMonth.set(row.month, [...(byMonth.get(row.month) ?? []), entry]);
    }
    const result = new SpendingReportDto();
    result.from = range.from;
    result.to = range.to;
    result.months = range.months.map((month) => {
      const items = (byMonth.get(month) ?? []).sort(
        (a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name),
      );
      return Object.assign(new SpendingMonthDto(), {
        month,
        totalMinor: items.reduce((sum, item) => sum + item.amountMinor, 0),
        envelopes: items,
      });
    });
    return result;
  }

  // Income and expense transactions per month; transfers live in their own table and never count.
  async incomeExpense(
    planId: string,
    query: ReportRangeQueryDto,
  ): Promise<IncomeExpenseReportDto> {
    const range = await this.range(planId, query);
    const rows: { month: string; income: string; expense: string }[] =
      await this.dataSource.query(
        `SELECT to_char(t.occurred_at AT TIME ZONE p.time_zone, 'YYYY-MM') AS month,
                COALESCE(SUM(t.amount_minor) FILTER (WHERE t.direction = 'income'), 0)::text AS income,
                COALESCE(SUM(t.amount_minor) FILTER (WHERE t.direction = 'expense'), 0)::text AS expense
           FROM transactions t JOIN plans p ON p.id = t.plan_id
          WHERE t.plan_id = $1 AND t.deleted_at IS NULL
          GROUP BY 1`,
        [planId],
      );
    const byMonth = new Map(rows.map((row) => [row.month, row]));
    const result = new IncomeExpenseReportDto();
    result.from = range.from;
    result.to = range.to;
    result.months = range.months.map((month) =>
      Object.assign(new IncomeExpenseMonthDto(), {
        month,
        incomeMinor: Number(byMonth.get(month)?.income ?? 0),
        expenseMinor: Number(byMonth.get(month)?.expense ?? 0),
      }),
    );
    return result;
  }

  // Σ of the active balances at the end of each month: every movement up to it, so months before
  // `from` still feed the balance.
  async netWorth(
    planId: string,
    query: ReportRangeQueryDto,
  ): Promise<NetWorthReportDto> {
    const range = await this.range(planId, query);
    const movements = await this.accounts.ledgerBalanceMovements(
      planId,
      range.plan.timeZone,
    );
    const result = new NetWorthReportDto();
    result.from = range.from;
    result.to = range.to;
    result.months = range.months.map((month) =>
      Object.assign(new NetWorthMonthDto(), {
        month,
        balanceMinor: movements
          .filter((movement) => compareMonths(movement.month, month) <= 0)
          .reduce((sum, movement) => sum + movement.amountMinor, 0),
      }),
    );
    return result;
  }

  private async range(
    planId: string,
    query: ReportRangeQueryDto,
  ): Promise<Range> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const to: MonthKey = query.to ?? currentMonth(plan.timeZone);
    const from: MonthKey = query.from ?? addMonths(to, -5);
    if (compareMonths(from, to) > 0) {
      throw new BadRequestException(['from must not be after to']);
    }
    const months = monthRange(from, to);
    if (months.length > MAX_MONTHS) {
      throw new BadRequestException([
        `the range must not exceed ${MAX_MONTHS} months`,
      ]);
    }
    return { plan, from, to, months };
  }
}
