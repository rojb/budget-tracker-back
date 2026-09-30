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
import type { EnvelopeIcon } from '../envelope-icons.js';
import { EnvelopeGroup } from './envelope-group.entity.js';

// An envelope of a plan. Its money is never stored here: Assigned and Available are derived by the
// budget engine from assignments and transactions.
@Entity({ name: 'envelopes' })
export class Envelope {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  // Null when the envelope has no group ("Sin grupo"), e.g. after its group was deleted.
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @ManyToOne(() => EnvelopeGroup, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'group_id' })
  group!: Relation<EnvelopeGroup> | null;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'tag' })
  icon!: EnvelopeIcon;

  // Zero-based place inside its group (or among the envelopes without a group).
  @Column({ type: 'integer' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
