import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import {
  TRANSACTION_DIRECTIONS,
  type TransactionDirection,
} from '../entities/transaction.entity.js';

// A trailing Z or numeric offset: the contract requires instants with a UTC offset.
const OFFSET_SUFFIX = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

export class CreateTransactionSplitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  envelopeId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 15800 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;
}

export class CreateTransactionDto {
  @ApiProperty({
    enum: TRANSACTION_DIRECTIONS,
    enumName: 'TransactionDirection',
  })
  @IsIn(TRANSACTION_DIRECTIONS)
  direction!: TransactionDirection;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 18450 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(OFFSET_SUFFIX, {
    message: 'occurredAt must be an ISO-8601 instant with a UTC offset',
  })
  occurredAt!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  payeeId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 60, example: 'Coto' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  payeeName?: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'Compra semanal' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  envelopeId?: string;

  @ApiPropertyOptional({
    type: [CreateTransactionSplitDto],
    minItems: 2,
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionSplitDto)
  splits?: CreateTransactionSplitDto[];
}
