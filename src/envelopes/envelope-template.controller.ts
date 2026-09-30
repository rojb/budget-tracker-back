import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorDto } from '../common/dto/error.dto.js';
import { EnvelopeTemplateDto } from './dto/envelope-template.dto.js';

// The same starter template for every plan, so any signed-in user may read it.
@ApiTags('Envelopes')
@Controller('envelope-template')
export class EnvelopeTemplateController {
  @Get()
  @ApiOperation({
    operationId: 'getEnvelopeTemplate',
    summary: 'Get the suggested starter template',
  })
  @ApiOkResponse({ description: 'The template.', type: EnvelopeTemplateDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  get(): EnvelopeTemplateDto {
    return EnvelopeTemplateDto.current();
  }
}
