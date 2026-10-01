import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { minorAmountTransformer } from '../../common/database/minor-amount.transformer.js';

// One recorded move of money between two envelopes (FR-25). History only: the assignments hold the
// money, nothing is computed from this table. An envelope id becomes null when that envelope is
// deleted, which is why the names are kept.
@Entity({ name: 'envelope_moves' })
export class EnvelopeMove {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'from_envelope_id', type: 'uuid', nullable: true })
  fromEnvelopeId!: string | null;

  @Column({ name: 'to_envelope_id', type: 'uuid', nullable: true })
  toEnvelopeId!: string | null;

  @Column({ name: 'from_envelope_name', type: 'varchar', length: 60 })
  fromEnvelopeName!: string;

  @Column({ name: 'to_envelope_name', type: 'varchar', length: 60 })
  toEnvelopeName!: string;

  // Always positive.
  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: minorAmountTransformer,
  })
  amountMinor!: number;

  // The budget month the move was made for (YYYY-MM).
  @Column({ type: 'char', length: 7 })
  month!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
