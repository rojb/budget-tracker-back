import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanMember } from './entities/plan-member.entity.js';
import type { PlanRole } from './plan-role.js';

// Authorization by plan membership (PRD §7). Every plan-scoped endpoint calls require() first:
// a non-member (or an unknown plan) gets 404 so plan ids are not revealed, and a member whose
// role is not allowed gets 403. Exported for the other plan-scoped modules.
@Injectable()
export class PlanAccessService {
  constructor(
    @InjectRepository(PlanMember)
    private readonly members: Repository<PlanMember>,
  ) {}

  async require(
    planId: string,
    userId: string,
    allowed: readonly PlanRole[],
  ): Promise<PlanMember> {
    const member = await this.members.findOneBy({ planId, userId });
    if (!member) {
      throw new NotFoundException('Plan not found');
    }
    if (!allowed.includes(member.role)) {
      throw new ForbiddenException(
        'Your role in this plan does not allow this action',
      );
    }
    return member;
  }
}
