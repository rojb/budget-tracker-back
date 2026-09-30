import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import type { PlanRole } from '../plan-role.js';
import { Plan } from './plan.entity.js';

@Entity({ name: 'plan_members' })
export class PlanMember {
  @PrimaryColumn({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 10 })
  role!: PlanRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne(() => Plan, (plan) => plan.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
