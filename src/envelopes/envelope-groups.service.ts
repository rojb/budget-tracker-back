import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database/unique-violation.js';
import {
  EnvelopeGroupDto,
  type CreateEnvelopeGroupDto,
  type UpdateEnvelopeGroupDto,
} from './dto/envelope-group.dto.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope } from './entities/envelope.entity.js';

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class EnvelopeGroupsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EnvelopeGroup)
    private readonly groups: Repository<EnvelopeGroup>,
  ) {}

  async list(planId: string): Promise<EnvelopeGroupDto[]> {
    const rows = await this.groups.find({
      where: { planId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    const counts = await this.envelopeCounts(planId);
    return rows.map((row) =>
      EnvelopeGroupDto.fromEntity(row, counts.get(row.id) ?? 0),
    );
  }

  // The group is placed after the existing ones.
  async create(
    planId: string,
    dto: CreateEnvelopeGroupDto,
  ): Promise<EnvelopeGroupDto> {
    const [{ next }] = await this.groups.query<{ next: number }[]>(
      `SELECT COALESCE(MAX("position"), -1) + 1 AS next FROM "envelope_groups" WHERE "plan_id" = $1`,
      [planId],
    );
    const group = await this.saveUnique(
      this.groups.create({ planId, name: dto.name, position: Number(next) }),
    );
    return EnvelopeGroupDto.fromEntity(group, 0);
  }

  async rename(
    planId: string,
    groupId: string,
    dto: UpdateEnvelopeGroupDto,
  ): Promise<EnvelopeGroupDto> {
    const group = await this.find(planId, groupId);
    group.name = dto.name;
    const saved = await this.saveUnique(group);
    const counts = await this.envelopeCounts(planId);
    return EnvelopeGroupDto.fromEntity(saved, counts.get(saved.id) ?? 0);
  }

  // The envelopes of the group are kept, without a group, after the envelopes that already had
  // none ("Sin grupo"); no money, assignment or transaction is lost. The remaining groups are
  // renumbered so positions stay 0..n-1.
  async remove(planId: string, groupId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const group = await manager.findOneBy(EnvelopeGroup, {
        id: groupId,
        planId,
      });
      if (!group) {
        throw new NotFoundException('Envelope group not found');
      }
      const members = await manager.find(Envelope, {
        where: { planId, groupId },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
      const [{ max }] = await manager.query<{ max: number }[]>(
        `SELECT COALESCE(MAX("position"), -1) AS max FROM "envelopes"
           WHERE "plan_id" = $1 AND "group_id" IS NULL`,
        [planId],
      );
      let next = Number(max) + 1;
      for (const envelope of members) {
        await manager.update(Envelope, envelope.id, {
          groupId: null,
          position: next++,
        });
      }
      await manager.delete(EnvelopeGroup, { id: groupId });
      const remaining = await manager.find(EnvelopeGroup, {
        where: { planId },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
      for (const [index, other] of remaining.entries()) {
        if (other.position !== index) {
          await manager.update(EnvelopeGroup, other.id, { position: index });
        }
      }
    });
  }

  // `groupIds` must be a permutation of the plan's groups; anything else changes nothing.
  async reorder(
    planId: string,
    groupIds: string[],
  ): Promise<EnvelopeGroupDto[]> {
    const rows = await this.groups.find({ where: { planId } });
    const known = new Set(rows.map((row) => row.id));
    if (
      groupIds.length !== rows.length ||
      !groupIds.every((id) => known.has(id))
    ) {
      throw new BadRequestException([
        'groupIds must list every group of the plan exactly once',
      ]);
    }
    await this.dataSource.transaction(async (manager) => {
      for (const [index, id] of groupIds.entries()) {
        await manager.update(EnvelopeGroup, id, { position: index });
      }
    });
    return this.list(planId);
  }

  // Loading by id and plan together makes a group of another plan a 404.
  async find(planId: string, groupId: string): Promise<EnvelopeGroup> {
    const group = await this.groups.findOneBy({ id: groupId, planId });
    if (!group) {
      throw new NotFoundException('Envelope group not found');
    }
    return group;
  }

  private async envelopeCounts(planId: string): Promise<Map<string, number>> {
    const rows = await this.groups.query<{ groupId: string; total: string }[]>(
      `SELECT "group_id" AS "groupId", COUNT(*)::text AS total FROM "envelopes"
         WHERE "plan_id" = $1 AND "group_id" IS NOT NULL GROUP BY "group_id"`,
      [planId],
    );
    return new Map(rows.map((row) => [row.groupId, Number(row.total)]));
  }

  // The unique index is the source of truth; a pre-check would race.
  private async saveUnique(group: EnvelopeGroup): Promise<EnvelopeGroup> {
    try {
      return await this.groups.save(group);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Envelope group name already in use');
      }
      throw error;
    }
  }
}
