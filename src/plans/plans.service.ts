import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity.js';
import {
  DEFAULT_TIME_ZONE,
  type CreatePlanDto,
} from './dto/create-plan.dto.js';
import { PlanDto } from './dto/plan.dto.js';
import type { UpdatePlanDto } from './dto/update-plan.dto.js';
import { PlanMember } from './entities/plan-member.entity.js';
import { Plan } from './entities/plan.entity.js';

// Callers check membership and role with PlanAccessService before using these methods.
@Injectable()
export class PlansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
  ) {}

  async listForUser(userId: string): Promise<PlanDto[]> {
    const ids = await this.dataSource
      .getRepository(PlanMember)
      .find({ select: { planId: true }, where: { userId } });
    if (ids.length === 0) {
      return [];
    }
    const plans = await this.withMembers()
      .where('plan.id IN (:...ids)', { ids: ids.map((row) => row.planId) })
      .orderBy('plan.createdAt', 'ASC')
      .getMany();
    return plans.map((plan) => PlanDto.fromEntity(plan, userId));
  }

  // The creator becomes the only member, as owner; the first account, if any, is created in
  // the same transaction so a failure leaves nothing behind.
  async create(userId: string, dto: CreatePlanDto): Promise<PlanDto> {
    const planId = await this.dataSource.transaction(async (manager) => {
      const plan = await manager.save(
        manager.create(Plan, {
          name: dto.name,
          currencyCode: dto.currencyCode,
          timeZone: dto.timeZone ?? DEFAULT_TIME_ZONE,
        }),
      );
      await manager.save(
        manager.create(PlanMember, { planId: plan.id, userId, role: 'owner' }),
      );
      if (dto.firstAccount) {
        await manager.save(
          manager.create(Account, { ...dto.firstAccount, planId: plan.id }),
        );
      }
      return plan.id;
    });
    return this.get(planId, userId);
  }

  async get(planId: string, userId: string): Promise<PlanDto> {
    const plan = await this.withMembers()
      .where('plan.id = :planId', { planId })
      .getOneOrFail();
    return PlanDto.fromEntity(plan, userId);
  }

  // Loads the plan's time zone and currency for other modules (budget month attribution).
  findById(planId: string): Promise<Plan | null> {
    return this.plans.findOneBy({ id: planId });
  }

  async rename(
    planId: string,
    userId: string,
    dto: UpdatePlanDto,
  ): Promise<PlanDto> {
    await this.plans.update({ id: planId }, { name: dto.name });
    return this.get(planId, userId);
  }

  // Cascades to members, accounts, budget months and assignments (FKs ON DELETE CASCADE).
  async remove(planId: string): Promise<void> {
    await this.plans.delete({ id: planId });
  }

  private withMembers() {
    return this.plans
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.members', 'member')
      .leftJoinAndSelect('member.user', 'user');
  }
}
