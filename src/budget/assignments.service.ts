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
