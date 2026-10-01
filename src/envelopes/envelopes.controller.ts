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
  Query,
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
import { EnvelopeGoalDto } from './dto/envelope-goal.dto.js';
import {
  CreateEnvelopeDto,
  EnvelopeDto,
  EnvelopeListDto,
  ListEnvelopesQueryDto,
  ReorderEnvelopesDto,
  UpdateEnvelopeDto,
} from './dto/envelope.dto.js';
import {
  InitialAssignmentRequestDto,
  InitialAssignmentResultDto,
} from './dto/initial-assignment.dto.js';
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
    'Another envelope of the plan already has that name (case-insensitive).',
  type: ErrorDto,
});
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const envelopeIdParam = ApiParam({ name: 'envelopeId', format: 'uuid' });

@ApiTags('Envelopes')
@Controller('plans/:planId/envelopes')
export class EnvelopesController {
  constructor(
    private readonly envelopes: EnvelopesService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listEnvelopes',
    summary: 'List the envelopes with the figures of a month',
  })
  @planIdParam
  @ApiOkResponse({
    description: "The envelopes and the month's Ready to Assign.",
    type: EnvelopeListDto,
  })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ListEnvelopesQueryDto,
  ): Promise<EnvelopeListDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.envelopes.list(planId, query.month);
  }

  @Post()
  @ApiOperation({
    operationId: 'createEnvelope',
    summary: 'Create an envelope (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The envelope was created.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @nameTaken
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateEnvelopeDto,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.create(planId, dto);
  }

  @Put('order')
  @ApiOperation({
    operationId: 'reorderEnvelopes',
    summary: 'Set the order of the envelopes of a group (owner or editor)',
  })
  @planIdParam
  @ApiOkResponse({
    description: 'The envelopes in the new order.',
    type: [EnvelopeDto],
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async reorder(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: ReorderEnvelopesDto,
  ): Promise<EnvelopeDto[]> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.reorder(planId, dto.groupId, dto.envelopeIds);
  }

  @Post('initial-assignment')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'applyInitialAssignment',
    summary: 'Assign money to several envelopes at once (owner or editor)',
  })
  @planIdParam
  @ApiOkResponse({
    description: 'The month, the total assigned and the Ready to Assign.',
    type: InitialAssignmentResultDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async assignInitial(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: InitialAssignmentRequestDto,
  ): Promise<InitialAssignmentResultDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.assignInitial(planId, dto);
  }

  @Get(':envelopeId')
  @ApiOperation({ operationId: 'getEnvelope', summary: 'Get an envelope' })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({ description: 'The envelope.', type: EnvelopeDto })
  @badRequest
  @unauthorized
  @notFound
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.envelopes.get(planId, envelopeId);
  }

  @Patch(':envelopeId')
  @ApiOperation({
    operationId: 'updateEnvelope',
    summary: 'Edit or move an envelope (owner or editor)',
  })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({ description: 'The edited envelope.', type: EnvelopeDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @nameTaken
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
    @Body() dto: UpdateEnvelopeDto,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.update(planId, envelopeId, dto);
  }

  @Put(':envelopeId/goal')
  @ApiOperation({
    operationId: 'setEnvelopeGoal',
    summary: 'Set or replace the goal of an envelope (owner or editor)',
    description:
      'A `monthly` goal takes no `dueDate`; a `targetByDate` goal requires one, in the current month or later.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({
    description: 'The envelope with its goal.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async setGoal(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
    @Body() dto: EnvelopeGoalDto,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.setGoal(planId, envelopeId, dto);
  }

  @Delete(':envelopeId/goal')
  @ApiOperation({
    operationId: 'clearEnvelopeGoal',
    summary: 'Remove the goal of an envelope (owner or editor)',
    description: 'Responds `200` also when the envelope had no goal.',
  })
  @planIdParam
  @envelopeIdParam
  @ApiOkResponse({
    description: 'The envelope without a goal.',
    type: EnvelopeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async clearGoal(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
  ): Promise<EnvelopeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.envelopes.clearGoal(planId, envelopeId);
  }

  @Delete(':envelopeId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteEnvelope',
    summary: 'Delete an envelope (owner or editor)',
  })
  @planIdParam
  @envelopeIdParam
  @ApiNoContentResponse({ description: 'The envelope was deleted.' })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('envelopeId', parseUuid('envelopeId')) envelopeId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    await this.envelopes.remove(planId, envelopeId);
  }
}
