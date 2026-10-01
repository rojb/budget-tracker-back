import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import { AssignmentsService } from '../budget/assignments.service.js';
import { CalculationService } from '../budget/calculation.service.js';
import type { PlanLedger } from '../budget/calculation.types.js';
import {
  compareMonths,
  currentMonth,
  type MonthKey,
} from '../budget/month-key.js';
import { isUniqueViolation } from '../common/database/unique-violation.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { ListTransactionsQueryDto } from '../transactions/dto/transaction.dto.js';
import { TransactionLedgerService } from '../transactions/transaction-ledger.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { EnvelopeDetailDto } from './dto/envelope-detail.dto.js';
import { EnvelopeGoalDto } from './dto/envelope-goal.dto.js';
import {
  EnvelopeDto,
  EnvelopeLineDto,
  EnvelopeListDto,
  type CreateEnvelopeDto,
  type UpdateEnvelopeDto,
} from './dto/envelope.dto.js';
import {
  InitialAssignmentResultDto,
  type InitialAssignmentRequestDto,
} from './dto/initial-assignment.dto.js';
import { EnvelopeTemplateResultDto } from './dto/envelope-template.dto.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope, type GoalType } from './entities/envelope.entity.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { DEFAULT_ENVELOPE_ICON } from './envelope-icons.js';
import { ENVELOPE_TEMPLATE } from './envelope-template.js';

interface GoalColumns {
  goalType: GoalType | null;
  goalTargetMinor: number | null;
  goalDueDate: string | null;
}

// Last calendar day of a YYYY-MM month.
function daysInMonth(month: MonthKey): number {
  return new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
}

const NO_GOAL: GoalColumns = {
  goalType: null,
  goalTargetMinor: null,
  goalDueDate: null,
};

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class EnvelopesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Envelope)
    private readonly envelopes: Repository<Envelope>,
    @InjectRepository(EnvelopeGroup)
    private readonly groups: Repository<EnvelopeGroup>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    private readonly calculation: CalculationService,
    private readonly assignments: AssignmentsService,
    private readonly accounts: AccountsService,
    private readonly groupsService: EnvelopeGroupsService,
    private readonly transactions: TransactionLedgerService,
    private readonly transactionsService: TransactionsService,
  ) {}

  // The plan's envelopes in display order (by group position, those without a group last) with
  // the figures the budget engine derives for the month.
  async list(planId: string, month?: string): Promise<EnvelopeListDto> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const key: MonthKey = month ?? currentMonth(plan.timeZone);
    const rows = await this.ordered(planId);
    const ledger = await this.ledger(plan, rows);
    const state = this.calculation.calculateMonth(ledger, key);
    const result = new EnvelopeListDto();
    result.month = key;
    result.readyToAssignMinor = state.readyToAssignMinor;
    result.items = rows.map((row, index) =>
      EnvelopeLineDto.build(row, state.envelopes[index], key),
    );
    return result;
  }

  // One envelope of a month (FR-24): its line (figures, state, goal status), its carryover and the
  // month's activity, asked from the transactions list so the plan's time zone and the logical
  // deletion are applied by the code that owns them.
  async detail(
    planId: string,
    envelopeId: string,
    month?: string,
  ): Promise<EnvelopeDetailDto> {
    const envelope = await this.find(planId, envelopeId);
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const key: MonthKey = month ?? currentMonth(plan.timeZone);
    const rows = await this.ordered(planId);
    const state = this.calculation.calculateMonth(
      await this.ledger(plan, rows),
      key,
    );
    const index = rows.findIndex((row) => row.id === envelope.id);
    const query = new ListTransactionsQueryDto();
    query.envelopeId = envelope.id;
    query.from = `${key}-01`;
    query.to = `${key}-${String(daysInMonth(key)).padStart(2, '0')}`;
    query.page = 1;
    query.pageSize = 100;
    const activity = await this.transactionsService.list(planId, query);
    const result = new EnvelopeDetailDto();
    result.month = key;
    result.line = EnvelopeLineDto.build(envelope, state.envelopes[index], key);
    result.carryoverMinor = state.envelopes[index].carryoverMinor;
    result.activity = activity.items;
    result.activityTotal = activity.total;
    return result;
  }

  // Facts of the plan in PlanLedger form: the balance movements (opening balances, transfers and
  // transactions), the assignments and the spending that transactions put on the envelopes.
  async ledger(plan: Plan, rows?: Envelope[]): Promise<PlanLedger> {
    const envelopes = rows ?? (await this.ordered(plan.id));
    return {
      currentMonth: currentMonth(plan.timeZone),
      envelopeIds: envelopes.map((row) => row.id),
      balanceMovements: await this.accounts.ledgerBalanceMovements(
        plan.id,
        plan.timeZone,
      ),
      assignments: await this.assignments.ledgerRows(plan.id),
      spending: await this.transactions.spending(plan.id, plan.timeZone),
    };
  }

  async create(planId: string, dto: CreateEnvelopeDto): Promise<EnvelopeDto> {
    if (dto.groupId) {
      await this.requireGroup(planId, dto.groupId);
    }
    const goal = dto.goal
      ? await this.goalColumns(planId, dto.goal)
      : NO_GOAL;
    const envelope = await this.saveUnique(
      this.envelopes.create({
        planId,
        groupId: dto.groupId ?? null,
        name: dto.name,
        icon: dto.icon ?? DEFAULT_ENVELOPE_ICON,
        position: await this.nextPosition(planId, dto.groupId ?? null),
        ...goal,
        photoFile: null,
        photoUpdatedAt: null,
      }),
    );
    return EnvelopeDto.fromEntity(envelope);
  }

  // Sets or replaces the goal (capability envelope-goals). Only the intent is stored; the required
  // amount and the state are derived by goal-status.ts on every read.
  async setGoal(
    planId: string,
    envelopeId: string,
    dto: EnvelopeGoalDto,
  ): Promise<EnvelopeDto> {
    const envelope = await this.find(planId, envelopeId);
    Object.assign(envelope, await this.goalColumns(planId, dto));
    return EnvelopeDto.fromEntity(await this.envelopes.save(envelope));
  }

  // Removing a goal the envelope does not have is not an error.
  async clearGoal(planId: string, envelopeId: string): Promise<EnvelopeDto> {
    const envelope = await this.find(planId, envelopeId);
    Object.assign(envelope, NO_GOAL);
    return EnvelopeDto.fromEntity(await this.envelopes.save(envelope));
  }

  async get(planId: string, envelopeId: string): Promise<EnvelopeDto> {
    return EnvelopeDto.fromEntity(await this.find(planId, envelopeId));
  }

  async update(
    planId: string,
    envelopeId: string,
    dto: UpdateEnvelopeDto,
  ): Promise<EnvelopeDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException([
        'at least one of name, icon or groupId must be sent',
      ]);
    }
    const envelope = await this.find(planId, envelopeId);
    if (dto.name !== undefined) envelope.name = dto.name;
    if (dto.icon !== undefined) envelope.icon = dto.icon;
    // Moving to another group places the envelope last there.
    if (dto.groupId !== undefined && dto.groupId !== envelope.groupId) {
      await this.requireGroup(planId, dto.groupId);
      envelope.groupId = dto.groupId;
      envelope.position = await this.nextPosition(planId, dto.groupId);
    }
    return EnvelopeDto.fromEntity(await this.saveUnique(envelope));
  }

  // The envelope's assignments go with it (FK ON DELETE CASCADE), so its money returns to Ready
  // to Assign; payees that suggested it lose the suggestion (ON DELETE SET NULL). Transactions keep
  // existing: their portions that used it lose the envelope (ON DELETE SET NULL, "Sin sobre").
  async remove(planId: string, envelopeId: string): Promise<void> {
    await this.find(planId, envelopeId);
    await this.envelopes.delete({ id: envelopeId, planId });
  }

  // `envelopeIds` must be a permutation of the envelopes of one group (or of the ungrouped ones
  // when there is no `groupId`); anything else changes nothing.
  async reorder(
    planId: string,
    groupId: string | undefined,
    envelopeIds: string[],
  ): Promise<EnvelopeDto[]> {
    if (groupId) {
      await this.requireGroup(planId, groupId);
    }
    const scope = await this.envelopes.find({
      where: { planId, groupId: groupId ?? IsNull() },
    });
    const known = new Set(scope.map((row) => row.id));
    if (
      envelopeIds.length !== scope.length ||
      !envelopeIds.every((id) => known.has(id))
    ) {
      throw new BadRequestException([
        'envelopeIds must list every envelope of the group exactly once',
      ]);
    }
    await this.dataSource.transaction(async (manager) => {
      for (const [index, id] of envelopeIds.entries()) {
        await manager.update(Envelope, id, { position: index });
      }
    });
    const reordered = await this.envelopes.find({
      where: { planId, groupId: groupId ?? IsNull() },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return reordered.map((row) => EnvelopeDto.fromEntity(row));
  }

  // Screen 46: stores each amount as the envelope's assignment for the month (replacing the previous
  // one) through the engine's assignment facts, all or nothing, and reports the month's Ready to
  // Assign, which is negative when more is assigned than is available (never clamped).
  async assignInitial(
    planId: string,
    dto: InitialAssignmentRequestDto,
  ): Promise<InitialAssignmentResultDto> {
    const plan = await this.plans.findOneByOrFail({ id: planId });
    const month: MonthKey = dto.month ?? currentMonth(plan.timeZone);
    const ids = dto.assignments.map((row) => row.envelopeId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException([
        'assignments must not repeat an envelope',
      ]);
    }
    if (
      (await this.envelopes.countBy({ planId, id: In(ids) })) !== ids.length
    ) {
      throw new NotFoundException('Envelope not found');
    }
    await this.assignments.setAssignments(planId, month, dto.assignments);
    const state = this.calculation.calculateMonth(
      await this.ledger(plan),
      month,
    );
    const result = new InitialAssignmentResultDto();
    result.month = month;
    result.assignedMinor = state.envelopes.reduce(
      (sum, envelope) => sum + envelope.assignedMinor,
      0,
    );
    result.readyToAssignMinor = state.readyToAssignMinor;
    return result;
  }

  // Creates the selected template envelopes (all of them when `names` is absent) without any
  // assigned amount, in template order, in one transaction. Only for a plan with no envelopes.
  // A group of the plan with the same name (ignoring case) is reused, and a group none of whose
  // envelopes is selected is not created.
  async applyTemplate(
    planId: string,
    names?: string[],
  ): Promise<EnvelopeTemplateResultDto> {
    const known = ENVELOPE_TEMPLATE.flatMap((group) =>
      group.envelopes.map((envelope) => envelope.name),
    );
    const selected = new Set(names ?? known);
    const unknown = [...selected].filter((name) => !known.includes(name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        unknown.map((name) => `"${name}" is not an envelope of the template`),
      );
    }
    await this.dataSource.transaction(async (manager) => {
      if ((await manager.countBy(Envelope, { planId })) > 0) {
        throw new ConflictException('The plan already has envelopes');
      }
      const existing = await manager.find(EnvelopeGroup, { where: { planId } });
      let nextGroupPosition =
        existing.reduce((max, group) => Math.max(max, group.position), -1) + 1;
      for (const templateGroup of ENVELOPE_TEMPLATE) {
        const members = templateGroup.envelopes.filter((envelope) =>
          selected.has(envelope.name),
        );
        if (members.length === 0) {
          continue;
        }
        const group =
          existing.find(
            (row) =>
              row.name.toLowerCase() === templateGroup.name.toLowerCase(),
          ) ??
          (await manager.save(
            manager.create(EnvelopeGroup, {
              planId,
              name: templateGroup.name,
              position: nextGroupPosition++,
            }),
          ));
        for (const [position, member] of members.entries()) {
          await manager.save(
            manager.create(Envelope, {
              planId,
              groupId: group.id,
              name: member.name,
              icon: member.icon,
              position,
            }),
          );
        }
      }
    });
    const result = new EnvelopeTemplateResultDto();
    result.groups = await this.groupsService.list(planId);
    result.envelopes = (await this.ordered(planId)).map((row) =>
      EnvelopeDto.fromEntity(row),
    );
    return result;
  }

  // Loading by id and plan together makes an envelope of another plan a 404.
  async find(planId: string, envelopeId: string): Promise<Envelope> {
    const envelope = await this.envelopes.findOneBy({ id: envelopeId, planId });
    if (!envelope) {
      throw new NotFoundException('Envelope not found');
    }
    return envelope;
  }

  private ordered(planId: string): Promise<Envelope[]> {
    return this.envelopes
      .createQueryBuilder('envelope')
      .leftJoin('envelope.group', 'group')
      .where('envelope.planId = :planId', { planId })
      .orderBy('group.position', 'ASC', 'NULLS LAST')
      .addOrderBy('envelope.position', 'ASC')
      .addOrderBy('envelope.createdAt', 'ASC')
      .getMany();
  }

  // The columns of a goal, after the rules that need more than one field or the plan: a monthly
  // goal has no due date, a goal with a date needs one, and not in a month already over.
  private async goalColumns(
    planId: string,
    goal: EnvelopeGoalDto,
  ): Promise<GoalColumns> {
    if (goal.type === 'monthly') {
      if (goal.dueDate !== undefined) {
        throw new BadRequestException([
          'dueDate must not be sent for a monthly goal',
        ]);
      }
      return {
        goalType: 'monthly',
        goalTargetMinor: goal.targetMinor,
        goalDueDate: null,
      };
    }
    if (goal.dueDate === undefined) {
      throw new BadRequestException([
        'dueDate is required for a targetByDate goal',
      ]);
    }
    const plan = await this.plans.findOneByOrFail({ id: planId });
    if (
      compareMonths(goal.dueDate.slice(0, 7), currentMonth(plan.timeZone)) < 0
    ) {
      throw new BadRequestException(['dueDate must not be in a past month']);
    }
    return {
      goalType: 'targetByDate',
      goalTargetMinor: goal.targetMinor,
      goalDueDate: goal.dueDate,
    };
  }

  private async requireGroup(planId: string, groupId: string): Promise<void> {
    const group = await this.groups.findOneBy({ id: groupId, planId });
    if (!group) {
      throw new NotFoundException('Envelope group not found');
    }
  }

  private async nextPosition(
    planId: string,
    groupId: string | null,
  ): Promise<number> {
    const [{ next }] = await this.envelopes.query<{ next: number }[]>(
      `SELECT COALESCE(MAX("position"), -1) + 1 AS next FROM "envelopes"
         WHERE "plan_id" = $1 AND "group_id" IS NOT DISTINCT FROM $2`,
      [planId, groupId],
    );
    return Number(next);
  }

  // The unique index is the source of truth; a pre-check would race.
  private async saveUnique(envelope: Envelope): Promise<Envelope> {
    try {
      return await this.envelopes.save(envelope);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Envelope name already in use');
      }
      throw error;
    }
  }
}
