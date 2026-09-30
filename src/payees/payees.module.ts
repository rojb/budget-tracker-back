import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module.js';
import { Payee } from './entities/payee.entity.js';
import { PayeesController } from './payees.controller.js';
import { PayeesService } from './payees.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payee]), PlansModule],
  controllers: [PayeesController],
  providers: [PayeesService],
  exports: [PayeesService],
})
export class PayeesModule {}
