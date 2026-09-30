import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
import {
  CreatePayeeDto,
  ListPayeesQueryDto,
  UpdatePayeeDto,
} from './dto/payee-requests.dto.js';
import { PayeeDto, PayeePageDto } from './dto/payee.dto.js';
import { PayeesService } from './payees.service.js';

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
const conflict = ApiConflictResponse({
  description:
    'Another active payee of the plan already has that name (case-insensitive).',
  type: ErrorDto,
});
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const payeeIdParam = ApiParam({ name: 'payeeId', format: 'uuid' });

@ApiTags('Payees')
@Controller('plans/:planId/payees')
export class PayeesController {
  constructor(
    private readonly payees: PayeesService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listPayees',
    summary: 'List and search payees',
  })
  @planIdParam
  @ApiOkResponse({ description: 'A page of payees.', type: PayeePageDto })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ListPayeesQueryDto,
  ): Promise<PayeePageDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.payees.list(planId, query);
  }

  @Post()
  @ApiOperation({
    operationId: 'createPayee',
    summary: 'Create a payee (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({ description: 'The payee was created.', type: PayeeDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @conflict
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreatePayeeDto,
  ): Promise<PayeeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.payees.create(planId, dto);
  }

  @Get(':payeeId')
  @ApiOperation({
    operationId: 'getPayee',
    summary: 'Get a payee, including a deleted one',
  })
  @planIdParam
  @payeeIdParam
  @ApiOkResponse({ description: 'The payee.', type: PayeeDto })
  @badRequest
  @unauthorized
  @notFound
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('payeeId', parseUuid('payeeId')) payeeId: string,
  ): Promise<PayeeDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.payees.get(planId, payeeId);
  }

  @Patch(':payeeId')
  @ApiOperation({
    operationId: 'updatePayee',
    summary: 'Edit an active payee (owner or editor)',
  })
  @planIdParam
  @payeeIdParam
  @ApiOkResponse({ description: 'The edited payee.', type: PayeeDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @conflict
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('payeeId', parseUuid('payeeId')) payeeId: string,
    @Body() dto: UpdatePayeeDto,
  ): Promise<PayeeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.payees.update(planId, payeeId, dto);
  }

  @Delete(':payeeId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deletePayee',
    summary: 'Delete a payee logically (owner or editor)',
  })
  @planIdParam
  @payeeIdParam
  @ApiNoContentResponse({ description: 'The payee was deleted.' })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('payeeId', parseUuid('payeeId')) payeeId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    await this.payees.remove(planId, payeeId);
  }
}
