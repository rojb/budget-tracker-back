import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';
import {
  ENVELOPE_ICONS,
  type EnvelopeIcon,
} from '../../envelopes/envelope-icons.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

// Range of months of a report (FR-26).
export class ReportRangeQueryDto {
  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      'First month of the range; five months before `to` when absent. At most 24 months.',
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'from must be a YYYY-MM month key' })
  from?: string;

  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      "Last month of the range; the current month in the plan's time zone when absent.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'to must be a YYYY-MM month key' })
  to?: string;
}

export class EnvelopeSpendingDto {
  @ApiProperty({ format: 'uuid' })
  envelopeId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ENVELOPE_ICONS })
  icon!: EnvelopeIcon;

  @ApiProperty({ type: 'integer', minimum: 1 })
  amountMinor!: number;
}

export class SpendingMonthDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: "Σ of the envelopes' spending in the month.",
  })
  totalMinor!: number;

  @ApiProperty({
    type: [EnvelopeSpendingDto],
    description: 'Envelopes with spending above zero, largest first.',
  })
  envelopes!: EnvelopeSpendingDto[];
}

export class SpendingReportDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-04' })
  from!: string;

  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  to!: string;

  @ApiProperty({ type: [SpendingMonthDto] })
  months!: SpendingMonthDto[];
}

export class IncomeExpenseMonthDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({ type: 'integer' })
  incomeMinor!: number;

  @ApiProperty({ type: 'integer' })
  expenseMinor!: number;
}

export class IncomeExpenseReportDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-04' })
  from!: string;

  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  to!: string;

  @ApiProperty({ type: [IncomeExpenseMonthDto] })
  months!: IncomeExpenseMonthDto[];
}

export class NetWorthMonthDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Σ balances of the active accounts at the end of the month.',
  })
  balanceMinor!: number;
}

export class NetWorthReportDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-04' })
  from!: string;

  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  to!: string;

  @ApiProperty({ type: [NetWorthMonthDto] })
  months!: NetWorthMonthDto[];
}
