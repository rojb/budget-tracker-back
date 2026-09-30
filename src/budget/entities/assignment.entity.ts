import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';
import { BudgetMonth } from './budget-month.entity.js';

// Money given to one envelope in one budget month. At most one per envelope and month.
@Entity({ name: 'assignments' })
@Unique('UQ_assignments_month_envelope', ['budgetMonthId', 'envelopeId'])
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_month_id', type: 'uuid' })
  budgetMonthId!: string;

  @ManyToOne(() => BudgetMonth, (month) => month.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'budget_month_id' })
  budgetMonth!: Relation<BudgetMonth>;

  // FK to envelopes is added by add-envelopes.
  @Column({ name: 'envelope_id', type: 'uuid' })
  envelopeId!: string;

  // Integer minor units; may be zero or negative (money taken back).
  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  amountMinor!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
