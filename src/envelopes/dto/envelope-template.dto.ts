import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';
import { ENVELOPE_ICONS, type EnvelopeIcon } from '../envelope-icons.js';
import { ENVELOPE_TEMPLATE, type TemplateGroup } from '../envelope-template.js';
import { EnvelopeGroupDto } from './envelope-group.dto.js';
import { EnvelopeDto } from './envelope.dto.js';

export class TemplateEnvelopeDto {
  @ApiProperty({ example: 'Alquiler' })
  name!: string;

  @ApiProperty({ enum: ENVELOPE_ICONS })
  icon!: EnvelopeIcon;
}

export class TemplateGroupDto {
  @ApiProperty({ example: 'Obligaciones' })
  name!: string;

  @ApiProperty({ type: [TemplateEnvelopeDto] })
  envelopes!: TemplateEnvelopeDto[];
}

export class EnvelopeTemplateDto {
  @ApiProperty({ type: [TemplateGroupDto] })
  groups!: TemplateGroupDto[];

  static current(): EnvelopeTemplateDto {
    const dto = new EnvelopeTemplateDto();
    dto.groups = ENVELOPE_TEMPLATE.map((group: TemplateGroup) => ({
      name: group.name,
      envelopes: group.envelopes.map((envelope) => ({ ...envelope })),
    }));
    return dto;
  }
}

export class ApplyEnvelopeTemplateDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Names of the template envelopes to create; all of them when absent.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  envelopeNames?: string[];
}

export class EnvelopeTemplateResultDto {
  @ApiProperty({ type: [EnvelopeGroupDto] })
  groups!: EnvelopeGroupDto[];

  @ApiProperty({ type: [EnvelopeDto] })
  envelopes!: EnvelopeDto[];
}
