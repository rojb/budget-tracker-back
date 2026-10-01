import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { READ_ROLES, WRITE_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import { EnvelopeDto } from './dto/envelope.dto.js';
import { SuggestedPhotoRequestDto } from './dto/photo.dto.js';
import {
  EnvelopePhotosService,
  PHOTO_MAX_BYTES,
} from './envelope-photos.service.js';

const unauthorized = ApiUnauthorizedResponse({
  description: 'Missing or invalid bearer token.',
  type: ErrorDto,
});
const badRequest = ApiBadRequestResponse({
  description: 'The request failed validation.',
  type: ValidationErrorDto,
});
const notFound = ApiNotFoundResponse({
  description: 'The resource does not exist.',
  type: ErrorDto,
});
const forbidden = ApiForbiddenResponse({
  description: "The caller's role in the plan does not allow this operation.",
  type: ErrorDto,
});
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const envelopeIdParam = ApiParam({ name: 'envelopeId', format: 'uuid' });

// What the in-memory multer storage hands over; the rest of its fields are not used.
interface UploadedPhoto {
  buffer: Buffer;
}

@ApiTags('Envelopes')
@Controller('plans/:planId/envelopes/:envelopeId/photo')
export class EnvelopePhotosController {
  constructor(
    private readonly photos: EnvelopePhotosService,
    private readonly access: PlanAccessService,
  ) {}

  // Photos are only ever served from here, never from a static mount, so every byte goes through
  // the bearer guard and the membership check.
  @Get()
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    operationId: 'getEnvelopePhoto',
    summary: 'Get the photo of an envelope (any member)',
    description:
      'Served only with a valid bearer token to a member of the plan; `404` for a non-member and for an envelope without a photo.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiProduces('image/jpeg')
  @ApiOkResponse({
    description: 'The photo, a JPEG resized to at most 1080 pixels wide.',
    content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } },
  })
  @badRequest
  @unauthorized
  @notFound
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
  ): Promise<StreamableFile> {
    await this.access.require(planId, user.id, READ_ROLES);
    const { stream, size } = await this.photos.open(planId, envelopeId);
    return new StreamableFile(stream, { type: 'image/jpeg', length: size });
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES, files: 1 } }),
  )
  @ApiOperation({
    operationId: 'uploadEnvelopePhoto',
    summary: 'Set or replace the photo of an envelope (owner or editor)',
    description:
      'A JPEG, PNG or WebP image of at most 5 MB in the multipart field `file`. The type is decided by the content of the file, not by its name or declared type. The server resizes it to at most 1080 pixels wide, strips its metadata and stores it as JPEG; the previous photo file is deleted.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The image (JPEG, PNG or WebP, at most 5 MB).',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'The envelope with its new `photoUrl`.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiResponse({
    status: 413,
    description: 'The uploaded file is larger than 5 MB.',
    type: ErrorDto,
  })
  @ApiResponse({
    status: 415,
    description:
      'The file is not a JPEG, PNG or WebP image (decided by its content) or cannot be decoded.',
    type: ErrorDto,
  })
  async upload(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
    @UploadedFile() file: UploadedPhoto | undefined,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    if (!file) {
      throw new BadRequestException(['file is required']);
    }
    return this.photos.set(planId, envelopeId, file.buffer);
  }

  @Post('suggested')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'applySuggestedEnvelopePhoto',
    summary:
      'Set a suggested photo as the photo of an envelope (owner or editor)',
    description:
      'The suggestion goes through the same resizing and storage as an upload.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({
    description: 'The envelope with its new `photoUrl`.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async applySuggested(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
    @Body() dto: SuggestedPhotoRequestDto,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.photos.setSuggested(planId, envelopeId, dto.suggestionId);
  }

  @Delete()
  @ApiOperation({
    operationId: 'deleteEnvelopePhoto',
    summary: 'Remove the photo of an envelope (owner or editor)',
    description:
      'Deletes the stored file; responds `200` also when the envelope had no photo.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({
    description: 'The envelope without `photoUrl`.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.photos.remove(planId, envelopeId);
  }
}
