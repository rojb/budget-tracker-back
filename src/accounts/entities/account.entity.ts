import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';
import { Plan } from '../../plans/entities/plan.entity.js';

export const ACCOUNT_TYPES = ['bank', 'digitalWallet', 'cash'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// No balance column: the balance is derived from the opening balance and the transactions (FR-03).
@Entity({ name: 'accounts' })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: AccountType;

  @Column({
    name: 'opening_balance_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  openingBalanceMinor!: number;

  // Archived instead of deleted; null while active.
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
