import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetModule } from '../budget/budget.module.js';
import { BudgetMonth } from '../budget/entities/budget-month.entity.js';
import { EnvelopesModule } from '../envelopes/envelopes.module.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { PlansModule } from '../plans/plans.module.js';
import { MonthsController } from './months.controller.js';
import { MonthsService } from './months.service.js';

// Monthly assignment (add-monthly-assignment): reads the envelope lines and the plan's ledger from
// EnvelopesModule and writes only assignment facts and close confirmations (BudgetModule).
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, BudgetMonth]),
    PlansModule,
    BudgetModule,
    EnvelopesModule,
  ],
  controllers: [MonthsController],
  providers: [MonthsService],
})
export class MonthsModule {}
