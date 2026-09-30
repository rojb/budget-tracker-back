import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsService } from './assignments.service.js';
import { CalculationService } from './calculation.service.js';
import { Assignment } from './entities/assignment.entity.js';
import { BudgetMonth } from './entities/budget-month.entity.js';

// Budget engine (add-budget-calc-engine). No controller: the endpoints that use it arrive with
// add-envelopes, add-transactions and add-monthly-assignment.
@Module({
  imports: [TypeOrmModule.forFeature([BudgetMonth, Assignment])],
  providers: [CalculationService, AssignmentsService],
  exports: [CalculationService, AssignmentsService],
})
export class BudgetModule {}
