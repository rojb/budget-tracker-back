import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AccountTransfer } from './entities/account-transfer.entity.js';
import { Account } from './entities/account.entity.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountTransfer]), PlansModule],
  controllers: [AccountsController, TransfersController],
  providers: [AccountsService, TransfersService],
  exports: [AccountsService],
})
export class AccountsModule {}
