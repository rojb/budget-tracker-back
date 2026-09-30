import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';

export class ListAccountsQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'List archived accounts instead of active ones.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  archived?: boolean;
}

export class AccountDetailQueryDto {
  @ApiPropertyOptional({
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
    description:
      "Month of the inflow/outflow figures; defaults to the current month in the plan's time zone.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month must be a YYYY-MM month key' })
  month?: string;
}
