import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { GOAL_TYPES, type GoalType } from '../entities/envelope.entity.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// The goal of an envelope (capability `envelope-goals`). The cross-field rules (a monthly goal has
// no due date, a goal with a date needs one, not in a past month) are checked by EnvelopesService.
export class EnvelopeGoalDto {
  @ApiProperty({
    enum: GOAL_TYPES,
    enumName: 'EnvelopeGoalType',
    description:
      '`monthly` is an amount to assign every month; `targetByDate` is an amount to have available by a due date.',
  })
  @IsIn(GOAL_TYPES)
  type!: GoalType;

  @ApiProperty({ type: 'integer', minimum: 1, example: 180000 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  targetMinor!: number;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    example: '2026-12-15',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dueDate must be a date YYYY-MM-DD' })
  @IsDateString({ strict: true })
  dueDate?: string;
}
