import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity.js';
import { PlanMember } from './entities/plan-member.entity.js';
import { Plan } from './entities/plan.entity.js';
import { PlanAccessService } from './plan-access.service.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanMember, Account])],
  controllers: [PlansController],
  providers: [PlansService, PlanAccessService],
  exports: [PlansService, PlanAccessService],
})
export class PlansModule {}
