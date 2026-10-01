import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
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

  // Adds a signed amount to the assignment of each envelope for one month (add-envelope-goals, move
  // money): `amount_minor + delta` is applied by the database in one statement, so two moves cannot
  // lose each other's change, and all rows or none change. An envelope with no assignment yet starts
  // from zero. Deltas are applied in envelope order so concurrent moves cannot deadlock. The caller
  // checks that the envelopes belong to the plan.
  async shiftAssignments(
    planId: string,
    month: MonthKey,
    deltas: { envelopeId: string; deltaMinor: number }[],
    outer?: EntityManager,
  ): Promise<void> {
    assertMonthKey(month);
    for (const row of deltas) {
      if (!Number.isSafeInteger(row.deltaMinor)) {
        throw new RangeError(
          `deltaMinor must be an integer in minor units, got ${row.deltaMinor}`,
        );
      }
    }
    if (deltas.length === 0) {
      return;
    }
    const ordered = [...deltas].sort((a, b) =>
      a.envelopeId.localeCompare(b.envelopeId),
    );
    // Inside the caller's transaction when it holds one (a move locks its source first).
    const run = <T>(work: (manager: EntityManager) => Promise<T>) =>
      outer ? work(outer) : this.dataSource.transaction(work);
    await run(async (manager) => {
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
      const params: unknown[] = [budgetMonth.id];
      const values = ordered.map((row) => {
        params.push(row.envelopeId, row.deltaMinor);
        return `($1, $${params.length - 1}, $${params.length})`;
      });
      await manager.query(
        `INSERT INTO "assignments" ("budget_month_id", "envelope_id", "amount_minor")
         VALUES ${values.join(', ')}
         ON CONFLICT ("budget_month_id", "envelope_id") DO UPDATE
           SET "amount_minor" = "assignments"."amount_minor" + EXCLUDED."amount_minor",
               "updated_at" = now()`,
        params,
      );
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
