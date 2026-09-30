import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
import type { User } from '../users/entities/user.entity.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { PlanDto } from './dto/plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { PlanAccessService } from './plan-access.service.js';
import { OWNER_ROLES, READ_ROLES } from './plan-role.js';
import { PlansService } from './plans.service.js';

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

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listPlans', summary: 'List my plans' })
  @ApiOkResponse({ description: "The caller's plans.", type: [PlanDto] })
  @unauthorized
  list(@CurrentUser() user: User): Promise<PlanDto[]> {
    return this.plans.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ operationId: 'createPlan', summary: 'Create a plan' })
  @ApiCreatedResponse({ description: 'The plan was created.', type: PlanDto })
  @badRequest
  @unauthorized
  create(
    @CurrentUser() user: User,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanDto> {
    return this.plans.create(user.id, dto);
  }

  @Get(':planId')
  @ApiOperation({ operationId: 'getPlan', summary: 'Get a plan' })
  @planIdParam
  @ApiOkResponse({ description: 'The plan and its members.', type: PlanDto })
  @badRequest
  @unauthorized
  @notFound
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
  ): Promise<PlanDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.plans.get(planId, user.id);
  }

  @Patch(':planId')
  @ApiOperation({
    operationId: 'updatePlan',
    summary: 'Rename a plan (owner only)',
  })
  @planIdParam
  @ApiOkResponse({ description: 'The renamed plan.', type: PlanDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanDto> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    return this.plans.rename(planId, user.id, dto);
  }

  @Delete(':planId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deletePlan',
    summary: 'Delete a plan (owner only)',
  })
  @planIdParam
  @ApiNoContentResponse({ description: 'The plan was deleted.' })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    await this.plans.remove(planId);
  }
}
