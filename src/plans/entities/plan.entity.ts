import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { CurrencyCode } from '../currency.js';
import { PlanMember } from './plan-member.entity.js';

@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  // Immutable after creation (FR-40).
  @Column({ name: 'currency_code', type: 'character', length: 3 })
  currencyCode!: CurrencyCode;

  // IANA zone used to attribute transactions to budget months.
  @Column({ name: 'time_zone', type: 'varchar', length: 64 })
  timeZone!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => PlanMember, (member) => member.plan)
  members!: Relation<PlanMember>[];
}
