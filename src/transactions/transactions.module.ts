import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity.js';
import { Envelope } from '../envelopes/entities/envelope.entity.js';
import { Payee } from '../payees/entities/payee.entity.js';
import { PayeesModule } from '../payees/payees.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { TransactionSplit } from './entities/transaction-split.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

// Records and lists transactions. It reads accounts and envelopes through their repositories (not
// their modules) so the read-side modules can depend on the ledger without a cycle.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionSplit,
      Account,
      Envelope,
      Payee,
    ]),
    PlansModule,
    PayeesModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
