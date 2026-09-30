import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { OWNER_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import { CreateInvitationDto, InvitationDto } from './dto/sharing.dto.js';
import { SharingService } from './sharing.service.js';

const ownerOnly = [
  ApiBadRequestResponse({
    description: 'The request failed validation.',
    type: ValidationErrorDto,
  }),
  ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  }),
  ApiForbiddenResponse({
    description: "The caller's role in the plan does not allow this operation.",
    type: ErrorDto,
  }),
  ApiNotFoundResponse({
    description: 'The resource does not exist.',
    type: ErrorDto,
  }),
];
const decorate =
  (...decorators: MethodDecorator[]): MethodDecorator =>
  (target, key, descriptor) => {
    for (const decorator of decorators) decorator(target, key, descriptor);
  };

@ApiTags('Sharing')
@Controller('plans/:planId/invitation')
export class PlanInvitationController {
  constructor(
    private readonly sharing: SharingService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'getInvitation',
    summary: "Get the plan's active invitation (owner only)",
  })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ description: 'The active invitation.', type: InvitationDto })
  @decorate(...ownerOnly)
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
  ): Promise<InvitationDto> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    return this.sharing.activeInvitation(planId);
  }

  @Post()
  @ApiOperation({
    operationId: 'createInvitation',
    summary: 'Generate an invitation code (owner only)',
  })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiCreatedResponse({
    description: 'The new invitation.',
    type: InvitationDto,
  })
  @decorate(...ownerOnly)
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationDto> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    return this.sharing.createInvitation(planId, user.id, dto.role);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    operationId: 'revokeInvitation',
    summary: 'Revoke the active invitation (owner only)',
  })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The code no longer works.' })
  @decorate(...ownerOnly)
  async revoke(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    await this.sharing.revoke(planId);
  }
}
