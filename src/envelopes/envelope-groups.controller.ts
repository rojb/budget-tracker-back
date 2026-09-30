import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { READ_ROLES, WRITE_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import {
  ApplyEnvelopeTemplateDto,
  EnvelopeTemplateResultDto,
} from './dto/envelope-template.dto.js';
import {
  CreateEnvelopeGroupDto,
  EnvelopeGroupDto,
  ReorderEnvelopeGroupsDto,
  UpdateEnvelopeGroupDto,
} from './dto/envelope-group.dto.js';
import { EnvelopeGroupsService } from './envelope-groups.service.js';
import { EnvelopesService } from './envelopes.service.js';

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
const nameTaken = ApiConflictResponse({
  description:
    'Another group of the plan already has that name (case-insensitive).',
  type: ErrorDto,
});
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const groupIdParam = ApiParam({ name: 'groupId', format: 'uuid' });

@ApiTags('Envelopes')
@Controller('plans/:planId/envelope-groups')
export class EnvelopeGroupsController {
  constructor(
    private readonly groups: EnvelopeGroupsService,
    private readonly envelopes: EnvelopesService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listEnvelopeGroups',
    summary: 'List the envelope groups',
  })
  @planIdParam
  @ApiOkResponse({
    description: 'The groups of the plan.',
    type: [EnvelopeGroupDto],
  })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
  ): Promise<EnvelopeGroupDto[]> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.groups.list(planId);
  }

  @Post()
  @ApiOperation({
    operationId: 'createEnvelopeGroup',
    summary: 'Create an envelope group (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The group was created.',
    type: EnvelopeGroupDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @nameTaken
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateEnvelopeGroupDto,
  ): Promise<EnvelopeGroupDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.groups.create(planId, dto);
  }

  @Put('order')
  @ApiOperation({
    operationId: 'reorderEnvelopeGroups',
    summary: 'Set the order of the groups (owner or editor)',
  })
  @planIdParam
  @ApiOkResponse({
    description: 'The groups in the new order.',
    type: [EnvelopeGroupDto],
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async reorder(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: ReorderEnvelopeGroupsDto,
  ): Promise<EnvelopeGroupDto[]> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.groups.reorder(planId, dto.groupIds);
  }

  @Post('template')
  @ApiOperation({
    operationId: 'applyEnvelopeTemplate',
    summary: 'Create the starter template envelopes (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The groups and envelopes of the plan.',
    type: EnvelopeTemplateResultDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiConflictResponse({
    description: 'The plan already has envelopes.',
    type: ErrorDto,
  })
  async applyTemplate(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: ApplyEnvelopeTemplateDto,
  ): Promise<EnvelopeTemplateResultDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.applyTemplate(planId, dto.envelopeNames);
  }

  @Patch(':groupId')
  @ApiOperation({
    operationId: 'updateEnvelopeGroup',
    summary: 'Rename an envelope group (owner or editor)',
  })
  @planIdParam
  @groupIdParam
  @ApiOkResponse({
    description: 'The renamed group.',
    type: EnvelopeGroupDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @nameTaken
  async rename(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('groupId', parseUuid('groupId')) groupId: string,
    @Body() dto: UpdateEnvelopeGroupDto,
  ): Promise<EnvelopeGroupDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.groups.rename(planId, groupId, dto);
  }

  @Delete(':groupId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteEnvelopeGroup',
    summary: 'Delete an envelope group (owner or editor)',
  })
  @planIdParam
  @groupIdParam
  @ApiNoContentResponse({ description: 'The group was deleted.' })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('groupId', parseUuid('groupId')) groupId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    await this.groups.remove(planId, groupId);
  }
}
