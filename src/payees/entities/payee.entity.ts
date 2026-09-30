import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity.js';

// Deleted logically: past transactions keep referencing the row (FR-05).
@Entity({ name: 'payees' })
export class Payee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  // FK to envelopes is added by add-envelopes.
  @Column({ name: 'suggested_envelope_id', type: 'uuid', nullable: true })
  suggestedEnvelopeId!: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
