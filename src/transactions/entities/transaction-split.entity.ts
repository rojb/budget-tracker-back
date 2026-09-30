import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';
import { Envelope } from '../../envelopes/entities/envelope.entity.js';
import { Transaction } from './transaction.entity.js';

// One portion of a transaction. `envelopeId` is null for an income sent to Ready to Assign and for
// a portion whose envelope was deleted ("Sin sobre"): the row keeps its amount (ON DELETE SET NULL).
@Entity({ name: 'transaction_splits' })
export class TransactionSplit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.splits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Relation<Transaction>;

  @Column({ name: 'envelope_id', type: 'uuid', nullable: true })
  envelopeId!: string | null;

  @ManyToOne(() => Envelope, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'envelope_id' })
  envelope!: Relation<Envelope> | null;

  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  amountMinor!: number;

  // Zero-based order of the portion inside its transaction.
  @Column({ type: 'integer' })
  position!: number;
}
