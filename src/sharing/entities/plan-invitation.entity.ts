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

export const INVITATION_ROLES = ['editor', 'viewer'] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

// Active = not used, not revoked and not expired.
@Entity({ name: 'plan_invitations' })
export class PlanInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan!: Relation<Plan>;

  // Stored uppercase without the dash.
  @Column({ type: 'character', length: 6 })
  code!: string;

  @Column({ type: 'varchar', length: 10 })
  role!: InvitationRole;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'used_by', type: 'uuid', nullable: true })
  usedBy!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
