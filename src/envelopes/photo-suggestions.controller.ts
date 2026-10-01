import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { ErrorDto } from '../common/dto/error.dto.js';
import { PhotoSuggestionDto } from './dto/photo.dto.js';
import {
  findPhotoSuggestion,
  PHOTO_SUGGESTIONS,
  suggestionImagePath,
} from './photo-suggestions.js';

// The suggested goal photos are not plan data: any signed-in user reads them (the global bearer
// guard still applies).
@ApiTags('Envelopes')
@Controller('envelope-photo-suggestions')
export class PhotoSuggestionsController {
  @Get()
  @ApiOperation({
    operationId: 'listPhotoSuggestions',
    summary: 'List the suggested goal photos',
    description:
      'The same four suggestions for everyone, in order (`vacaciones`, `auto`, `emergencia`, `mudanza`), each with the path of its image.',
  })
  @ApiOkResponse({
    description: 'The suggested photos.',
    type: [PhotoSuggestionDto],
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  list(): PhotoSuggestionDto[] {
    return PHOTO_SUGGESTIONS.map((suggestion) => {
      const dto = new PhotoSuggestionDto();
      dto.id = suggestion.id;
      dto.name = suggestion.name;
      dto.imageUrl = suggestionImagePath(suggestion.id);
      return dto;
    });
  }

  @Get(':suggestionId/image')
  @Header('Cache-Control', 'private, max-age=86400')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    operationId: 'getPhotoSuggestionImage',
    summary: 'Get the image of a suggested goal photo',
  })
  @ApiParam({
    name: 'suggestionId',
    description:
      'Id of a suggested goal photo (`vacaciones`, `auto`, `emergencia` or `mudanza`).',
    example: 'vacaciones',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'The resource does not exist.',
    type: ErrorDto,
  })
  async image(
    @Param('suggestionId') suggestionId: string,
  ): Promise<StreamableFile> {
    const suggestion = findPhotoSuggestion(suggestionId);
    if (!suggestion) {
      throw new NotFoundException('Photo suggestion not found');
    }
    const { size } = await stat(suggestion.file);
    return new StreamableFile(createReadStream(suggestion.file), {
      type: 'image/jpeg',
      length: size,
    });
  }
}
