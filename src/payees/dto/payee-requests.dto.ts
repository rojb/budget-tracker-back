import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';

export class CreatePayeeDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Coto' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  suggestedEnvelopeId?: string;
}

// Only the fields sent change; an empty body is rejected by PayeesService.
export class UpdatePayeeDto extends PartialType(CreatePayeeDto) {}

export class ListPayeesQueryDto {
  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Case-insensitive part of the name.',
  })
  @IsOptional()
  @IsString()
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
