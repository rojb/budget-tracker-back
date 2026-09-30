import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module.js';
import { PlanInvitation } from './entities/plan-invitation.entity.js';
import { InvitationsController } from './invitations.controller.js';
import { MembersController } from './members.controller.js';
import { PlanInvitationController } from './plan-invitation.controller.js';
import { SharingService } from './sharing.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PlanInvitation]), PlansModule],
  controllers: [
    PlanInvitationController,
    InvitationsController,
    MembersController,
  ],
  providers: [SharingService],
})
export class SharingModule {}
