import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';

// Money moved between two accounts of the same plan (FR-28). Never an envelope movement.
@Entity({ name: 'account_transfers' })
export class AccountTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'from_account_id', type: 'uuid' })
  fromAccountId!: string;

  @Column({ name: 'to_account_id', type: 'uuid' })
  toAccountId!: string;

  // Always positive.
  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  amountMinor!: number;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
