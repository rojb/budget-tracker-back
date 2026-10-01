import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';
import type { Envelope } from '../entities/envelope.entity.js';
import { ENVELOPE_ICONS, type EnvelopeIcon } from '../envelope-icons.js';
import {
  describeLine,
  ENVELOPE_STATES,
  type EnvelopeState,
  type LineFigures,
} from '../goal-status.js';
import { EnvelopeGoalDto } from './envelope-goal.dto.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

export class EnvelopeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Supermercado' })
  name!: string;

  @ApiProperty({ enum: ENVELOPE_ICONS })
  icon!: EnvelopeIcon;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Absent when the envelope has no group ("Sin grupo").',
  })
  groupId?: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Zero-based place inside its group (or among the envelopes without a group).',
  })
  position!: number;

  // Absent when the envelope has no goal. No description here: with one, @nestjs/swagger wraps the
  // $ref in an allOf and the contract's plain $ref no longer matches.
  @ApiPropertyOptional({ type: EnvelopeGoalDto })
  goal?: EnvelopeGoalDto;

  @ApiPropertyOptional({
    description:
      "Path, relative to the API, of the envelope's photo (served only to members with a bearer token). It carries a `v` version query, so a changed photo is a new URL. Absent when the envelope has no photo.",
    example:
      '/plans/0d9c1d7e-6a0c-4a77-9d0e-6d1f2a3b4c5d/envelopes/7f1f6a64-3a60-4d5c-9a43-0a5c8c1f2b11/photo?v=1790000000000',
  })
  photoUrl?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(envelope: Envelope): EnvelopeDto {
    const dto = new EnvelopeDto();
    dto.id = envelope.id;
    dto.name = envelope.name;
    dto.icon = envelope.icon;
    if (envelope.groupId) {
      dto.groupId = envelope.groupId;
    }
    dto.position = envelope.position;
    if (envelope.goalType !== null && envelope.goalTargetMinor !== null) {
      const goal = new EnvelopeGoalDto();
      goal.type = envelope.goalType;
      goal.targetMinor = envelope.goalTargetMinor;
      if (envelope.goalDueDate) {
        goal.dueDate = envelope.goalDueDate;
      }
      dto.goal = goal;
    }
    if (envelope.photoFile && envelope.photoUpdatedAt) {
      dto.photoUrl = `/plans/${envelope.planId}/envelopes/${envelope.id}/photo?v=${envelope.photoUpdatedAt.getTime()}`;
    }
    dto.createdAt = envelope.createdAt.toISOString();
    return dto;
  }
}

export class GoalStatusDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Amount to assign in the month to be on track (the target for a monthly goal; the shortfall over the carryover spread over the months left, rounded up, for a goal with a date).',
  })
  requiredMinor!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'What the month still needs, `max(0, required - assigned)`.',
  })
  missingMinor!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Assigned of the month for a monthly goal; Available (floored at 0) for a goal with a date.',
  })
  savedMinor!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: '`max(0, target - saved)`.',
  })
  remainingMinor!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 100,
    description: 'Saved over target, floored and capped at 100.',
  })
  percent!: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    description:
      'Months from the viewed month to the due month; only for a goal with a date, 0 in the due month and after it.',
  })
  monthsRemaining?: number;
}

export class EnvelopeLineDto {
  @ApiProperty({ type: EnvelopeDto })
  envelope!: EnvelopeDto;

  @ApiProperty({ type: 'integer', description: 'Assigned in the month.' })
  assignedMinor!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Net outflow of the month (expenses minus income sent to the envelope); negative when income exceeds expenses.',
  })
  spentMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Assigned + carryover − spent; negative when overspent.',
  })
  availableMinor!: number;

  // Derived by goal-status.ts only: overspent, else underfunded (goal not covered), else funded.
  @ApiProperty({ enum: ENVELOPE_STATES, enumName: 'EnvelopeState' })
  state!: EnvelopeState;

  // Present only when the envelope has a goal.
  @ApiPropertyOptional({ type: GoalStatusDto })
  goalStatus?: GoalStatusDto;

  // One line of the month: the figures the budget engine derived plus what goal-status.ts says of
  // them, so the list, the detail and the move result describe an envelope the same way.
  static build(
    envelope: Envelope,
    figures: LineFigures,
    month: string,
  ): EnvelopeLineDto {
    const line = new EnvelopeLineDto();
    line.envelope = EnvelopeDto.fromEntity(envelope);
    line.assignedMinor = figures.assignedMinor;
    line.spentMinor = figures.spentMinor;
    line.availableMinor = figures.availableMinor;
    const goal =
      envelope.goalType !== null && envelope.goalTargetMinor !== null
        ? {
            type: envelope.goalType,
            targetMinor: envelope.goalTargetMinor,
            dueDate: envelope.goalDueDate,
          }
        : null;
    const described = describeLine(goal, figures, month);
    line.state = described.state;
    if (described.goalStatus) {
      line.goalStatus = Object.assign(new GoalStatusDto(), described.goalStatus);
    }
    return line;
  }
}

export class EnvelopeListDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Ready to Assign of the month; negative when over-assigned.',
  })
  readyToAssignMinor!: number;

  @ApiProperty({ type: [EnvelopeLineDto] })
  items!: EnvelopeLineDto[];
}

export class ListEnvelopesQueryDto {
  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      "Budget month as YYYY-MM; the current month in the plan's time zone when absent.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month must be a YYYY-MM month key' })
  month?: string;
}

export class CreateEnvelopeDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Suscripciones' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: ENVELOPE_ICONS, default: 'tag' })
  @IsOptional()
  @IsIn(ENVELOPE_ICONS)
  icon?: EnvelopeIcon;

  @ApiPropertyOptional({ type: EnvelopeGoalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnvelopeGoalDto)
  goal?: EnvelopeGoalDto;
}

// Only the fields sent change; an empty body is rejected by EnvelopesService.
export class UpdateEnvelopeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: ENVELOPE_ICONS })
  @IsOptional()
  @IsIn(ENVELOPE_ICONS)
  icon?: EnvelopeIcon;
}

export class ReorderEnvelopesDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The group whose envelopes are ordered; absent for the envelopes without a group.',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Every envelope of that scope exactly once, in the desired order.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  envelopeIds!: string[];
}
