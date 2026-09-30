import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { BudgetModule } from '../budget/budget.module.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { PlansModule } from '../plans/plans.module.js';
import { EnvelopeGroupsController } from './envelope-groups.controller.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { EnvelopesController } from './envelopes.controller.js';
import { EnvelopesService } from './envelopes.service.js';
import { EnvelopeGroup } from './entities/envelope-group.entity.js';
import { Envelope } from './entities/envelope.entity.js';

// Exports EnvelopesService for add-transactions and add-monthly-assignment (it builds the
// PlanLedger of a plan).
@Module({
  imports: [
    TypeOrmModule.forFeature([EnvelopeGroup, Envelope, Plan]),
    PlansModule,
    AccountsModule,
    BudgetModule,
  ],
  controllers: [EnvelopeGroupsController, EnvelopesController],
  providers: [EnvelopeGroupsService, EnvelopesService],
  exports: [EnvelopeGroupsService, EnvelopesService],
})
export class EnvelopesModule {}
