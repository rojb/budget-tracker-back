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

// An ordered group of envelopes. Deleting it keeps its envelopes (they lose the group).
@Entity({ name: 'envelope_groups' })
export class EnvelopeGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  // Zero-based place of the group in the plan.
  @Column({ type: 'integer' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
