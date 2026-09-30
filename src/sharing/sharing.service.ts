import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  IsNull,
  MoreThan,
  QueryFailedError,
} from 'typeorm';
import {
  CurrencyDto,
  type PlanDto,
  PlanMemberDto,
} from '../plans/dto/plan.dto.js';
import { PlanMember } from '../plans/entities/plan-member.entity.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { PlansService } from '../plans/plans.service.js';
import { InvitationDto, InvitationPreviewDto } from './dto/sharing.dto.js';
import {
  type InvitationRole,
  PlanInvitation,
} from './entities/plan-invitation.entity.js';
import { generateCode, INVITATION_TTL_MS } from './invitation-code.js';

const PG_UNIQUE_VIOLATION = '23505';
const MAX_MEMBERS = 5; // PRD §7: up to 5 members per plan.

// Callers check the owner role with PlanAccessService before the plan-scoped methods.
@Injectable()
export class SharingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly plans: PlansService,
  ) {}

  async activeInvitation(planId: string): Promise<InvitationDto> {
    const invitation = await this.findActive(this.dataSource.manager, {
      planId,
    });
    if (!invitation) {
      throw new NotFoundException('The plan has no active invitation');
    }
    return InvitationDto.fromEntity(invitation);
  }

  // Revokes the plan's pending invitation (if any) and creates a new one.
  async createInvitation(
    planId: string,
    userId: string,
    role: InvitationRole,
  ): Promise<InvitationDto> {
    for (let attempt = 0; ; attempt++) {
      try {
        const invitation = await this.dataSource.transaction(
          async (manager) => {
            await this.revokePending(manager, planId);
            return manager.save(
              manager.create(PlanInvitation, {
                planId,
                code: generateCode(),
                role,
                createdBy: userId,
                expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
              }),
            );
          },
        );
        return InvitationDto.fromEntity(invitation);
      } catch (error) {
        // A code collision (1 in ~10^9) is retried with a new code.
        if (attempt < 4 && this.isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }

  async revoke(planId: string): Promise<void> {
    const invitation = await this.findActive(this.dataSource.manager, {
      planId,
    });
    if (!invitation) {
      throw new NotFoundException('The plan has no active invitation');
    }
    await this.revokePending(this.dataSource.manager, planId);
  }

  async preview(code: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findActiveByCode(
      this.dataSource.manager,
      code,
    );
    const plan = await this.dataSource.getRepository(Plan).findOneOrFail({
      where: { id: invitation.planId },
      relations: { members: { user: true } },
    });
    const owner = plan.members.find((member) => member.role === 'owner');
    const dto = new InvitationPreviewDto();
    dto.planName = plan.name;
    dto.ownerName = owner?.user.name ?? '';
    dto.currency = CurrencyDto.fromCode(plan.currencyCode);
    dto.role = invitation.role;
    dto.expiresAt = invitation.expiresAt.toISOString();
    return dto;
  }

  // Single use: the invitation row is locked, checked and marked used in one transaction.
  async accept(code: string, userId: string): Promise<PlanDto> {
    const planId = await this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(PlanInvitation)
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .where('invitation.code = :code', { code })
        .andWhere('invitation.usedAt IS NULL')
        .andWhere('invitation.revokedAt IS NULL')
        .andWhere('invitation.expiresAt > now()')
        .getOne();
      if (!invitation) {
        throw new NotFoundException('Invitation code is invalid or expired');
      }
      const members = manager.getRepository(PlanMember);
      if (await members.existsBy({ planId: invitation.planId, userId })) {
        throw new ConflictException('You are already a member of this plan');
      }
      if (
        (await members.countBy({ planId: invitation.planId })) >= MAX_MEMBERS
      ) {
        throw new ConflictException('Plan is full');
      }
      invitation.usedAt = new Date();
      invitation.usedBy = userId;
      await manager.save(invitation);
      await manager.save(
        manager.create(PlanMember, {
          planId: invitation.planId,
          userId,
          role: invitation.role,
        }),
      );
      return invitation.planId;
    });
    return this.plans.get(planId, userId);
  }

  // Owner only (checked by the caller): editor <-> viewer; the owner's role never changes.
  async updateMember(
    planId: string,
    userId: string,
    role: InvitationRole,
  ): Promise<PlanMemberDto> {
    const members = this.dataSource.getRepository(PlanMember);
    const member = await members.findOne({
      where: { planId, userId },
      relations: { user: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === 'owner') {
      throw new ConflictException("The owner's membership cannot be changed");
    }
    member.role = role;
    await members.save(member);
    return PlanMemberDto.fromEntity(member);
  }

  // The owner removes another member, or a member leaves (removes themself). `callerRole` is
  // the caller's role in the plan, already loaded by PlanAccessService.
  async removeMember(
    planId: string,
    callerId: string,
    callerRole: string,
    userId: string,
  ): Promise<void> {
    const leaving = callerId === userId;
    if (!leaving && callerRole !== 'owner') {
      throw new ForbiddenException(
        'Your role in this plan does not allow this action',
      );
    }
    const members = this.dataSource.getRepository(PlanMember);
    const member = await members.findOneBy({ planId, userId });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === 'owner') {
      throw new ConflictException("The owner's membership cannot be changed");
    }
    await members.delete({ planId, userId });
  }

  private findActive(
    manager: EntityManager,
    where: { planId?: string; code?: string },
  ): Promise<PlanInvitation | null> {
    return manager.getRepository(PlanInvitation).findOne({
      where: {
        ...where,
        usedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  private async findActiveByCode(
    manager: EntityManager,
    code: string,
  ): Promise<PlanInvitation> {
    const invitation = await this.findActive(manager, { code });
    if (!invitation) {
      throw new NotFoundException('Invitation code is invalid or expired');
    }
    return invitation;
  }

  private async revokePending(
    manager: EntityManager,
    planId: string,
  ): Promise<void> {
    await manager
      .getRepository(PlanInvitation)
      .update(
        { planId, usedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        PG_UNIQUE_VIOLATION
    );
  }
}
