import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EnvelopeAmount } from './calculation.types.js';
import { Assignment } from './entities/assignment.entity.js';
import { BudgetMonth } from './entities/budget-month.entity.js';
import { assertMonthKey, type MonthKey } from './month-key.js';

// Stores assignment facts. Setting an envelope's amount for a month replaces the previous one.
@Injectable()
export class AssignmentsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async setAssignment(
    planId: string,
    envelopeId: string,
    month: MonthKey,
    amountMinor: number,
  ): Promise<void> {
    assertMonthKey(month);
    if (!Number.isSafeInteger(amountMinor)) {
      throw new RangeError(
        `amountMinor must be an integer in minor units, got ${amountMinor}`,
      );
    }
    await this.dataSource.transaction(async (manager) => {
      // Budget months are created lazily; the unique (plan, month) key makes this idempotent.
      await manager
        .createQueryBuilder()
        .insert()
        .into(BudgetMonth)
        .values({ planId, month })
        .orIgnore()
        .execute();
      const budgetMonth = await manager.findOneByOrFail(BudgetMonth, {
        planId,
        month,
      });
      await manager
        .createQueryBuilder()
        .insert()
        .into(Assignment)
        .values({ budgetMonthId: budgetMonth.id, envelopeId, amountMinor })
        .orUpdate(
          ['amount_minor', 'updated_at'],
          ['budget_month_id', 'envelope_id'],
        )
        .execute();
    });
  }

  // Sets several envelopes for one month at once (add-envelopes, screen 46): the same one-fact-per
  // -envelope-and-month rule as setAssignment, but all rows or none, in one transaction. The caller
  // checks that the envelopes belong to the plan.
  async setAssignments(
    planId: string,
    month: MonthKey,
    rows: { envelopeId: string; amountMinor: number }[],
  ): Promise<void> {
    assertMonthKey(month);
    for (const row of rows) {
      if (!Number.isSafeInteger(row.amountMinor)) {
        throw new RangeError(
          `amountMinor must be an integer in minor units, got ${row.amountMinor}`,
        );
      }
    }
    if (rows.length === 0) {
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(BudgetMonth)
        .values({ planId, month })
        .orIgnore()
        .execute();
      const budgetMonth = await manager.findOneByOrFail(BudgetMonth, {
        planId,
        month,
      });
      await manager
        .createQueryBuilder()
        .insert()
        .into(Assignment)
        .values(
          rows.map((row) => ({
            budgetMonthId: budgetMonth.id,
            envelopeId: row.envelopeId,
            amountMinor: row.amountMinor,
          })),
        )
        .orUpdate(
          ['amount_minor', 'updated_at'],
          ['budget_month_id', 'envelope_id'],
        )
        .execute();
    });
  }

  // Every assignment of the plan in PlanLedger form.
  async ledgerRows(planId: string): Promise<EnvelopeAmount[]> {
    const rows = await this.dataSource
      .getRepository(Assignment)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.budgetMonth', 'budgetMonth')
      .where('budgetMonth.planId = :planId', { planId })
      .getMany();
    return rows.map((row) => ({
      envelopeId: row.envelopeId,
      month: row.budgetMonth.month,
      amountMinor: row.amountMinor,
    }));
  }
}
