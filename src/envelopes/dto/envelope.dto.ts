import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../auth/dto/register.dto.js';
import { MONTH_KEY_PATTERN } from '../../budget/month-key.js';
import type { Envelope } from '../entities/envelope.entity.js';
import { ENVELOPE_ICONS, type EnvelopeIcon } from '../envelope-icons.js';

const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';

export class EnvelopeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Supermercado' })
  name!: string;

  @ApiProperty({ enum: ENVELOPE_ICONS })
  icon!: EnvelopeIcon;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Absent when the envelope has no group ("Sin grupo").',
  })
  groupId?: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Zero-based place inside its group (or among the envelopes without a group).',
  })
  position!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(envelope: Envelope): EnvelopeDto {
    const dto = new EnvelopeDto();
    dto.id = envelope.id;
    dto.name = envelope.name;
    dto.icon = envelope.icon;
    if (envelope.groupId) {
      dto.groupId = envelope.groupId;
    }
    dto.position = envelope.position;
    dto.createdAt = envelope.createdAt.toISOString();
    return dto;
  }
}

export class EnvelopeLineDto {
  @ApiProperty({ type: EnvelopeDto })
  envelope!: EnvelopeDto;

  @ApiProperty({ type: 'integer', description: 'Assigned in the month.' })
  assignedMinor!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Net outflow of the month (expenses minus income sent to the envelope); negative when income exceeds expenses.',
  })
  spentMinor!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Assigned + carryover − spent; negative when overspent.',
  })
  availableMinor!: number;
}

export class EnvelopeListDto {
  @ApiProperty({ pattern: MONTH_PATTERN, example: '2026-09' })
  month!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Ready to Assign of the month; negative when over-assigned.',
  })
  readyToAssignMinor!: number;

  @ApiProperty({ type: [EnvelopeLineDto] })
  items!: EnvelopeLineDto[];
}

export class ListEnvelopesQueryDto {
  @ApiPropertyOptional({
    pattern: MONTH_PATTERN,
    description:
      "Budget month as YYYY-MM; the current month in the plan's time zone when absent.",
  })
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month must be a YYYY-MM month key' })
  month?: string;
}

export class CreateEnvelopeDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Suscripciones' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: ENVELOPE_ICONS, default: 'tag' })
  @IsOptional()
  @IsIn(ENVELOPE_ICONS)
  icon?: EnvelopeIcon;
}

// Only the fields sent change; an empty body is rejected by EnvelopesService.
export class UpdateEnvelopeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: ENVELOPE_ICONS })
  @IsOptional()
  @IsIn(ENVELOPE_ICONS)
  icon?: EnvelopeIcon;
}

export class ReorderEnvelopesDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The group whose envelopes are ordered; absent for the envelopes without a group.',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Every envelope of that scope exactly once, in the desired order.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  envelopeIds!: string[];
}
