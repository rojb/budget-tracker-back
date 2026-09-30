import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Envelope } from '../envelopes/entities/envelope.entity.js';
import { PlansModule } from '../plans/plans.module.js';
import { TransactionLedgerModule } from '../transactions/transaction-ledger.module.js';
import { Payee } from './entities/payee.entity.js';
import { PayeesController } from './payees.controller.js';
import { PayeesService } from './payees.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payee, Envelope]),
    PlansModule,
    TransactionLedgerModule,
  ],
  controllers: [PayeesController],
  providers: [PayeesService],
  exports: [PayeesService],
})
export class PayeesModule {}
