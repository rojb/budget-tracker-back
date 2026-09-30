import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { PlanDto } from '../plans/dto/plan.dto.js';
import type { User } from '../users/entities/user.entity.js';
import { InvitationPreviewDto } from './dto/sharing.dto.js';
import { ParseInvitationCodePipe } from './parse-code.pipe.js';
import { SharingService } from './sharing.service.js';

const codeParam = ApiParam({
  name: 'code',
  description: 'Invitation code, with or without the dash, any letter case.',
  schema: { type: 'string', pattern: '^[A-Za-z0-9]{3}-?[A-Za-z0-9]{3}$' },
});

// Any signed-in user: whoever has the code may preview and join (FR-27).
@ApiTags('Sharing')
@Controller('invitations/:code')
export class InvitationsController {
  constructor(private readonly sharing: SharingService) {}

  @Get()
  @ApiOperation({
    operationId: 'previewInvitation',
    summary: 'Preview the plan behind a code',
  })
  @codeParam
  @ApiOkResponse({
    description: 'What joining would give.',
    type: InvitationPreviewDto,
  })
  @ApiBadRequestResponse({
    description: 'The request failed validation.',
    type: ValidationErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'The resource does not exist.',
    type: ErrorDto,
  })
  preview(
    @Param('code', ParseInvitationCodePipe) code: string,
  ): Promise<InvitationPreviewDto> {
    return this.sharing.preview(code);
  }

  @Post('accept')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'acceptInvitation',
    summary: 'Join the plan with a code',
  })
  @codeParam
  @ApiOkResponse({ description: 'The joined plan.', type: PlanDto })
  @ApiBadRequestResponse({
    description: 'The request failed validation.',
    type: ValidationErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'The resource does not exist.',
    type: ErrorDto,
  })
  @ApiConflictResponse({
    description:
      'The caller is already a member, or the plan already has 5 members.',
    type: ErrorDto,
  })
  accept(
    @CurrentUser() user: User,
    @Param('code', ParseInvitationCodePipe) code: string,
  ): Promise<PlanDto> {
    return this.sharing.accept(code, user.id);
  }
}
