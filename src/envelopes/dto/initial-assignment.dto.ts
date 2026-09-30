import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

export class InitialAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  envelopeId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 280000,
    description: "Amount in the plan currency's minor units.",
  })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;
}

export class InitialAssignmentRequestDto {
  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      "Budget month as YYYY-MM; the current month in the plan's time zone when absent.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month must be a YYYY-MM month key' })
  month?: string;

  @ApiProperty({ type: [InitialAssignmentDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InitialAssignmentDto)
  assignments!: InitialAssignmentDto[];
}

export class InitialAssignmentResultDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Total assigned to the plan envelopes in the month.',
  })
  assignedMinor!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Ready to Assign of the month after the assignment; negative when over-assigned.',
  })
  readyToAssignMinor!: number;
}
