import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { EnvelopesModule } from '../envelopes/envelopes.module.js';
import { Plan } from '../plans/entities/plan.entity.js';
import { PlansModule } from '../plans/plans.module.js';
import { TransactionLedgerModule } from '../transactions/transaction-ledger.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

// Reports (add-reports): read-only aggregations over the transaction and account ledgers.
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    PlansModule,
    AccountsModule,
    EnvelopesModule,
    TransactionLedgerModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
