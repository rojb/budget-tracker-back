import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { CreateAccountDto } from '../../accounts/dto/create-account.dto.js';
import { trim } from '../../auth/dto/register.dto.js';
import { CURRENCY_CODES, type CurrencyCode } from '../currency.js';

export const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

@ValidatorConstraint({ name: 'isTimeZone' })
class IsTimeZone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && TIME_ZONES.has(value);
  }

  defaultMessage(): string {
    return 'timeZone must be an IANA time zone';
  }
}

export class CreatePlanDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Mi plan' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiProperty({
    enum: CURRENCY_CODES,
    description:
      'Currency of a plan. Chosen at plan creation and immutable afterwards (FR-40).',
  })
  @IsIn(CURRENCY_CODES)
  currencyCode!: CurrencyCode;

  @ApiPropertyOptional({
    maxLength: 64,
    description: 'IANA time zone; defaults to America/Argentina/Buenos_Aires.',
  })
  @IsOptional()
  @MaxLength(64)
  @Validate(IsTimeZone)
  timeZone?: string;

  @ApiPropertyOptional({ type: CreateAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAccountDto)
  firstAccount?: CreateAccountDto;
}
