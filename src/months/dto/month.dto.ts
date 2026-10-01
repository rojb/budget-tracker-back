import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min, NotEquals } from 'class-validator';
import { EnvelopeLineDto } from '../../envelopes/dto/envelope.dto.js';

export const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

// The figures the budget engine derives for one month (02/04 Plan del mes).
export class MonthSummaryDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    pattern: MONTH_PATTERN,
    example: '2026-09',
    description: "Current month in the plan's time zone.",
  })
  currentMonth!: string;

  @ApiProperty({
    description: 'True when the month is after the current month.',
  })
  isFuture!: boolean;

  @ApiProperty({
    type: 'integer',
    description: 'Σ balances of the active accounts at the end of the month.',
  })
  balanceMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Σ Available of every envelope in the month.',
  })
  availableMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Σ Assigned in the months after this one.',
  })
  futureAssignedMinor!: number;

  @ApiProperty({
    type: 'integer',
    description:
      "Ready to Assign of the month; for a future month, the current month's.",
  })
  readyToAssignMinor!: number;

  @ApiProperty({ type: 'integer', description: 'Σ Assigned in the month.' })
  assignedMinor!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  envelopeCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  overspentCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  underfundedCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  fundedCount!: number;
}

// Money added to one envelope's assignment of a month (03/53 Asignar dinero).
export class AssignMoneyRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  envelopeId!: string;

  @ApiProperty({
    type: 'integer',
    example: 6200,
    description:
      "Amount added to the envelope's assignment of the month; negative takes money back, never 0.",
  })
  @IsInt()
  @NotEquals(0, { message: 'amountMinor must not be 0' })
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;
}

export class AssignMoneyResultDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description:
      'Ready to Assign of the month after the assignment; negative when over-assigned.',
  })
  readyToAssignMinor!: number;

  @ApiProperty({ type: EnvelopeLineDto })
  line!: EnvelopeLineDto;
}

export class CloseLineDto {
  @ApiProperty({ format: 'uuid' })
  envelopeId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'Amount carried, or deducted (positive), in minor units.',
  })
  amountMinor!: number;
}

// The close of a month into the next one (FR-12, screen 25).
export class MonthCloseDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  fromMonth!: string;

  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-10' })
  toMonth!: string;

  @ApiProperty({
    type: [CloseLineDto],
    description:
      'Envelopes whose positive Available carries into the next month.',
  })
  carried!: CloseLineDto[];

  @ApiProperty({
    type: [CloseLineDto],
    description:
      "Overspent envelopes, deducted from the next month's Ready to Assign; they restart at 0.",
  })
  deducted!: CloseLineDto[];

  @ApiProperty({ type: 'integer' })
  totalDeductedMinor!: number;

  @ApiProperty({ type: 'integer' })
  readyToAssignFromMinor!: number;

  @ApiProperty({ type: 'integer' })
  readyToAssignToMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Σ account balances at the end of the next month.',
  })
  balanceMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Σ Available of the next month.',
  })
  availableMinor!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Σ Assigned after the next month; balance − available − this = readyToAssignTo.',
  })
  futureAssignedMinor!: number;

  @ApiProperty({
    description: 'True once an owner or editor confirmed the close.',
  })
  confirmed!: boolean;
}
