import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
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
}

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

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
