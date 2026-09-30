import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Assignment } from './assignment.entity.js';

// A budget month of a plan. It only groups facts (assignments); nothing derived is stored.
@Entity({ name: 'budget_months' })
@Unique('UQ_budget_months_plan_month', ['planId', 'month'])
export class BudgetMonth {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // FK to plans is added by add-plans-and-accounts.
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // YYYY-MM (CHECK constraint in the migration).
  @Column({ type: 'character', length: 7 })
  month!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => Assignment, (assignment) => assignment.budgetMonth)
  assignments!: Relation<Assignment>[];
}
