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
import type { EnvelopeIcon } from '../envelope-icons.js';
import { EnvelopeGroup } from './envelope-group.entity.js';

export const GOAL_TYPES = ['monthly', 'targetByDate'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

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

  // The goal is the user's intent only (add-envelope-goals): the required amount, the state and the
  // progress are derived on every read and never stored. All three are null without a goal, and
  // the due date is set only for a goal with a date.
  @Column({ name: 'goal_type', type: 'varchar', length: 16, nullable: true })
  goalType!: GoalType | null;

  @Column({
    name: 'goal_target_minor',
    type: 'bigint',
    nullable: true,
    transformer: minorAmountTransformer,
  })
  goalTargetMinor!: number | null;

  // A plain calendar date (YYYY-MM-DD), not an instant: the budget month it belongs to decides.
  @Column({ name: 'goal_due_date', type: 'date', nullable: true })
  goalDueDate!: string | null;

  // Storage key of the photo file under PHOTOS_DIR, and when it was set (the version of its URL).
  @Column({ name: 'photo_file', type: 'varchar', length: 120, nullable: true })
  photoFile!: string | null;

  @Column({ name: 'photo_updated_at', type: 'timestamptz', nullable: true })
  photoUpdatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
