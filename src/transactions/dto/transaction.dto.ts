import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import {
  TRANSACTION_DIRECTIONS,
  type Transaction,
  type TransactionDirection,
} from '../entities/transaction.entity.js';

export class TransactionSplitDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Absent for an income sent to Ready to Assign and for a portion whose envelope was deleted ("Sin sobre").',
  })
  envelopeId?: string;

  @ApiPropertyOptional({ example: 'Supermercado' })
  envelopeName?: string;

  @ApiProperty({ type: 'integer', minimum: 1 })
  amountMinor!: number;
}

export class TransactionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: TRANSACTION_DIRECTIONS,
    enumName: 'TransactionDirection',
    description:
      '`expense` moves money out of the account, `income` moves money in.',
  })
  direction!: TransactionDirection;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ example: 'Banco Nación' })
  accountName!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: "Positive amount in the plan currency's minor units.",
  })
  amountMinor!: number;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  payeeId?: string;

  @ApiPropertyOptional({
    example: 'Coto',
    description: 'Name of the payee, also when it was deleted afterwards.',
  })
  payeeName?: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'Compra semanal' })
  description?: string;

  @ApiProperty({ type: [TransactionSplitDto], minItems: 1 })
  splits!: TransactionSplitDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  // `accountName`, `payeeName` and the envelope names come from joins the service performs.
  static fromEntity(
    transaction: Transaction,
    splits: TransactionSplitDto[],
    names: { accountName: string; payeeName?: string },
  ): TransactionDto {
    const dto = new TransactionDto();
    dto.id = transaction.id;
    dto.direction = transaction.direction;
    dto.accountId = transaction.accountId;
    dto.accountName = names.accountName;
    dto.amountMinor = transaction.amountMinor;
    dto.occurredAt = transaction.occurredAt.toISOString();
    if (transaction.payeeId) {
      dto.payeeId = transaction.payeeId;
      if (names.payeeName !== undefined) dto.payeeName = names.payeeName;
    }
    if (transaction.description) dto.description = transaction.description;
    dto.splits = splits;
    dto.createdAt = transaction.createdAt.toISOString();
    return dto;
  }
}

export class TransactionSummaryDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Sum of the matching expenses (money that left).',
  })
  outflowMinor!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Sum of the matching incomes (money that came in).',
  })
  inflowMinor!: number;
}

export class TransactionPageDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Count of all matching items across pages.',
  })
  total!: number;

  @ApiProperty({ type: [TransactionDto] })
  items!: TransactionDto[];

  @ApiProperty({
    type: TransactionSummaryDto,
    description:
      'Totals of every transaction the filters select, not only of this page.',
  })
  summary!: TransactionSummaryDto;
}

// `YYYY-MM-DD` and `HH:mm`: the plan's local date and time of day.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only the transactions recorded on this account.',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only the transactions of this payee.',
  })
  @IsOptional()
  @IsUUID()
  payeeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Only the transactions with at least one portion on this envelope.',
  })
  @IsOptional()
  @IsUUID()
  envelopeId?: string;

  @ApiPropertyOptional({
    enum: TRANSACTION_DIRECTIONS,
    enumName: 'TransactionDirection',
  })
  @IsOptional()
  @IsIn(TRANSACTION_DIRECTIONS)
  direction?: TransactionDirection;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description:
      'First local date included (`YYYY-MM-DD`). Must not be after `to`.',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from must be a date YYYY-MM-DD' })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    description: 'Last local date included (`YYYY-MM-DD`).',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to must be a date YYYY-MM-DD' })
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    type: 'string',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
    example: '18:00',
    description:
      'Start of the local time-of-day range, inclusive to the minute (`HH:mm`), on any date. When it is after `timeTo` the range crosses midnight.',
  })
  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'timeFrom must be a time HH:mm' })
  timeFrom?: string;

  @ApiPropertyOptional({
    type: 'string',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
    example: '23:59',
    description:
      'End of the local time-of-day range, inclusive to the minute (`HH:mm`).',
  })
  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'timeTo must be a time HH:mm' })
  timeTo?: string;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 60,
    description:
      'Text search, without letter case, over the payee name, the description and the name of the envelope of any portion.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    default: 1,
    description: '1-based page number.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Items per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
