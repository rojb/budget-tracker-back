import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';
import { EnvelopeLineDto } from './envelope.dto.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

// Money moved between two envelopes inside one month (FR-25, screen 24).
export class MoveMoneyRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromEnvelopeId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toEnvelopeId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 6200 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      "Budget month as YYYY-MM; the current month in the plan's time zone when absent.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month must be a YYYY-MM month key' })
  month?: string;
}

export class MoveMoneyResultDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Ready to Assign of the month; a move never changes it.',
  })
  readyToAssignMinor!: number;

  @ApiProperty({ type: EnvelopeLineDto })
  from!: EnvelopeLineDto;

  @ApiProperty({ type: EnvelopeLineDto })
  to!: EnvelopeLineDto;
}
