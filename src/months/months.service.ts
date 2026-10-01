import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AssignmentsService } from '../budget/assignments.service.js';
import { CalculationService } from '../budget/calculation.service.js';
import type { EnvelopeTotal } from '../budget/calculation.types.js';
import { BudgetMonth } from '../budget/entities/budget-month.entity.js';
import {
  compareMonths,
  currentMonth,
  type MonthKey,
} from '../budget/month-key.js';
import { EnvelopesService } from '../envelopes/envelopes.service.js';
import { Plan } from '../plans/entities/plan.entity.js';
import {
  AssignMoneyResultDto,
  CloseLineDto,
  MonthCloseDto,
  MonthSummaryDto,
  type AssignMoneyRequestDto,
} from './dto/month.dto.js';

// Monthly assignment (add-monthly-assignment): the month summary of 02/04, adding money to an
// envelope in any month (03/53) and the month close of 25. Every figure comes from the budget
// engine on each call; the only thing stored besides assignments is the close confirmation.
// Callers check membership and role with PlanAccessService first.
@Injectable()
export class MonthsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(BudgetMonth)
    private readonly budgetMonths: Repository<BudgetMonth>,
    private readonly calculation: CalculationService,
    private readonly assignments: AssignmentsService,
    private readonly envelopes: EnvelopesService,
  ) {}

  async summary(planId: string, month: MonthKey): Promise<MonthSummaryDto> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const [list, ledger] = await Promise.all([
      this.envelopes.list(planId, month),
      this.envelopes.ledger(plan),
    ]);
    const state = this.calculation.calculateMonth(ledger, month);
    const count = (wanted: string) =>
      list.items.filter((line) => line.state === wanted).length;
    const result = new MonthSummaryDto();
    result.month = month;
    result.currentMonth = ledger.currentMonth;
    result.isFuture = state.isFuture;
    result.balanceMinor = state.balanceMinor;
    result.availableMinor = state.availableMinor;
    result.futureAssignedMinor = state.futureAssignedMinor;
    result.readyToAssignMinor = state.readyToAssignMinor;
    result.assignedMinor = state.envelopes.reduce(
      (sum, envelope) => sum + envelope.assignedMinor,
      0,
    );
    result.envelopeCount = list.items.length;
    result.overspentCount = count('overspent');
    result.underfundedCount = count('underfunded');
    result.fundedCount = count('funded');
    return result;
  }

  // Adds the amount to the envelope's assignment of the month. The database applies the delta in
  // one statement (shiftAssignments), so two assignments at the same time never lose each other.
  async assign(
    planId: string,
    month: MonthKey,
    dto: AssignMoneyRequestDto,
  ): Promise<AssignMoneyResultDto> {
    // 404 when the envelope is not one of the plan's.
    await this.envelopes.get(planId, dto.envelopeId);
    await this.assignments.shiftAssignments(planId, month, [
      { envelopeId: dto.envelopeId, deltaMinor: dto.amountMinor },
    ]);
    const list = await this.envelopes.list(planId, month);
    const result = new AssignMoneyResultDto();
    result.month = month;
    result.readyToAssignMinor = list.readyToAssignMinor;
    result.line = list.items.find(
      (line) => line.envelope.id === dto.envelopeId,
    )!;
    return result;
  }

  async close(planId: string, month: MonthKey): Promise<MonthCloseDto> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const [list, ledger, budgetMonth] = await Promise.all([
      this.envelopes.list(planId, month),
      this.envelopes.ledger(plan),
      this.budgetMonths.findOneBy({ planId, month }),
    ]);
    const close = this.calculation.closeMonth(ledger, month);
    const names = new Map(
      list.items.map((line) => [line.envelope.id, line.envelope.name]),
    );
    const lines = (rows: EnvelopeTotal[]) =>
      rows.map((row) =>
        Object.assign(new CloseLineDto(), {
          envelopeId: row.envelopeId,
          name: names.get(row.envelopeId) ?? '',
          amountMinor: row.amountMinor,
        }),
      );
    const result = new MonthCloseDto();
    result.fromMonth = close.fromMonth;
    result.toMonth = close.toMonth;
    result.carried = lines(close.carried);
    result.deducted = lines(close.deducted);
    result.totalDeductedMinor = close.totalDeductedMinor;
    result.readyToAssignFromMinor = close.readyToAssignFromMinor;
    result.readyToAssignToMinor = close.readyToAssignToMinor;
    result.balanceMinor = close.toBalanceMinor;
    result.availableMinor = close.toAvailableMinor;
    result.futureAssignedMinor = close.toFutureAssignedMinor;
    result.confirmed = budgetMonth?.closedAt != null;
    return result;
  }

  // Records that the close was seen. Only a month that has ended; repeating keeps the first date.
  async confirmClose(planId: string, month: MonthKey): Promise<MonthCloseDto> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    if (compareMonths(month, currentMonth(plan.timeZone)) >= 0) {
      throw new ConflictException('The month has not ended yet');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(BudgetMonth)
        .values({ planId, month })
        .orIgnore()
        .execute();
      await manager.update(
        BudgetMonth,
        { planId, month, closedAt: IsNull() },
        { closedAt: () => 'now()' },
      );
    });
    return this.close(planId, month);
  }
}
