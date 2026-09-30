import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { AccountTransfer } from '../entities/account-transfer.entity.js';

export class TransferDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  fromAccountId!: string;

  @ApiProperty({ format: 'uuid' })
  toAccountId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: "Positive amount in the plan currency's minor units.",
  })
  amountMinor!: number;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(transfer: AccountTransfer): TransferDto {
    const dto = new TransferDto();
    dto.id = transfer.id;
    dto.fromAccountId = transfer.fromAccountId;
    dto.toAccountId = transfer.toAccountId;
    dto.amountMinor = transfer.amountMinor;
    dto.occurredAt = transfer.occurredAt.toISOString();
    dto.createdAt = transfer.createdAt.toISOString();
    return dto;
  }
}

export class TransferPageDto {
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

  @ApiProperty({ type: [TransferDto] })
  items!: TransferDto[];
}

export class CreateTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromAccountId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toAccountId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 20000 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  occurredAt!: string;
}

export class ListTransfersQueryDto {
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
