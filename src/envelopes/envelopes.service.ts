import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import { AssignmentsService } from '../budget/assignments.service.js';
import { CalculationService } from '../budget/calculation.service.js';
import type { PlanLedger } from '../budget/calculation.types.js';
import { currentMonth, type MonthKey } from '../budget/month-key.js';
import { isUniqueViolation } from '../common/database/unique-violation.js';
import { Plan } from '../plans/entities/plan.entity.js';
import {
  EnvelopeDto,
  EnvelopeLineDto,
  EnvelopeListDto,
  type CreateEnvelopeDto,
  type UpdateEnvelopeDto,
} from './dto/envelope.dto.js';
import { EnvelopeTemplateResultDto } from './dto/envelope-template.dto.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope } from './entities/envelope.entity.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { DEFAULT_ENVELOPE_ICON } from './envelope-icons.js';
import { ENVELOPE_TEMPLATE } from './envelope-template.js';

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
    result.items = rows.map((row, index) => {
      const line = new EnvelopeLineDto();
      line.envelope = EnvelopeDto.fromEntity(row);
      line.assignedMinor = state.envelopes[index].assignedMinor;
      line.availableMinor = state.envelopes[index].availableMinor;
      return line;
    });
    return result;
  }

  // Facts of the plan in PlanLedger form. `add-transactions` extends this single method with its
  // balance movements and `spending` rows; until then no envelope has any spending.
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
      spending: [],
    };
  }

  async create(planId: string, dto: CreateEnvelopeDto): Promise<EnvelopeDto> {
    if (dto.groupId) {
      await this.requireGroup(planId, dto.groupId);
    }
    const envelope = await this.saveUnique(
      this.envelopes.create({
        planId,
        groupId: dto.groupId ?? null,
        name: dto.name,
        icon: dto.icon ?? DEFAULT_ENVELOPE_ICON,
        position: await this.nextPosition(planId, dto.groupId ?? null),
      }),
    );
    return EnvelopeDto.fromEntity(envelope);
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
  // to Assign; payees that suggested it lose the suggestion (ON DELETE SET NULL). Transactions
  // will keep existing without an envelope once add-transactions references envelopes the same way.
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
