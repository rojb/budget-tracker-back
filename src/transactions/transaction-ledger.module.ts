import { Module } from '@nestjs/common';
import { TransactionLedgerService } from './transaction-ledger.service.js';

// Leaf module: imported by accounts, envelopes, payees and transactions, imports none of them.
@Module({
  providers: [TransactionLedgerService],
  exports: [TransactionLedgerService],
})
export class TransactionLedgerModule {}
