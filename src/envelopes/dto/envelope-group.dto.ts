import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import type { EnvelopeGroup } from '../entities/envelope-group.entity.js';

export class EnvelopeGroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Día a día' })
  name!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Zero-based place of the group in the plan.',
  })
  position!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  envelopeCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(
    group: EnvelopeGroup,
    envelopeCount: number,
  ): EnvelopeGroupDto {
    const dto = new EnvelopeGroupDto();
    dto.id = group.id;
    dto.name = group.name;
    dto.position = group.position;
    dto.envelopeCount = envelopeCount;
    dto.createdAt = group.createdAt.toISOString();
    return dto;
  }
}

export class CreateEnvelopeGroupDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Hogar' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}

export class UpdateEnvelopeGroupDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}

export class ReorderEnvelopeGroupsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Every group of the plan exactly once, in the desired order.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  groupIds!: string[];
}
