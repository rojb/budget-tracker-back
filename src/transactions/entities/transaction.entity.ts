import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity.js';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';
import { Payee } from '../../payees/entities/payee.entity.js';
import { Plan } from '../../plans/entities/plan.entity.js';
import { TransactionSplit } from './transaction-split.entity.js';

export const TRANSACTION_DIRECTIONS = ['expense', 'income'] as const;
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

// An expense or an income on one account (FR-06). `amountMinor` is always positive; the direction
// gives the sign. Its portions (splits) always add up to it.
@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  // The payee is soft-deleted, never removed, so past transactions keep showing it (FR-05).
  @Column({ name: 'payee_id', type: 'uuid', nullable: true })
  payeeId!: string | null;

  @ManyToOne(() => Payee, { nullable: true })
  @JoinColumn({ name: 'payee_id' })
  payee!: Relation<Payee> | null;

  @Column({ type: 'varchar', length: 7 })
  direction!: TransactionDirection;

  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  amountMinor!: number;

  // The time is part of the fact (FR-07); its budget month is the one of the instant in the plan's
  // time zone.
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  description!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => TransactionSplit, (split) => split.transaction)
  splits!: Relation<TransactionSplit[]>;
}
