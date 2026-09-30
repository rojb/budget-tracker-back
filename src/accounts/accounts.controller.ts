import {
  Body,
  Controller,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { currentMonth } from '../budget/month-key.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { READ_ROLES, WRITE_ROLES } from '../plans/plan-role.js';
import { PlansService } from '../plans/plans.service.js';
import type { User } from '../users/entities/user.entity.js';
import { AccountsService } from './accounts.service.js';
import {
  AccountDetailQueryDto,
  ListAccountsQueryDto,
} from './dto/account-queries.dto.js';
import { AccountDetailDto, AccountDto } from './dto/account.dto.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

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
  description: 'The resource is already in the requested state.',
  type: ErrorDto,
});
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const accountIdParam = ApiParam({ name: 'accountId', format: 'uuid' });

@ApiTags('Accounts')
@Controller('plans/:planId/accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly plans: PlansService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listAccounts', summary: 'List accounts' })
  @planIdParam
  @ApiOkResponse({ description: 'The accounts.', type: [AccountDto] })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ListAccountsQueryDto,
  ): Promise<AccountDto[]> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.accounts.list(planId, query.archived ?? false);
  }

  @Post()
  @ApiOperation({
    operationId: 'createAccount',
    summary: 'Create an account (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The account was created.',
    type: AccountDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.accounts.create(planId, dto);
  }

  @Get(':accountId')
  @ApiOperation({
    operationId: 'getAccount',
    summary: 'Get an account with its monthly inflow and outflow',
  })
  @planIdParam
  @accountIdParam
  @ApiOkResponse({ description: 'The account.', type: AccountDetailDto })
  @badRequest
  @unauthorized
  @notFound
  async get(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('accountId', parseUuid('accountId')) accountId: string,
    @Query() query: AccountDetailQueryDto,
  ): Promise<AccountDetailDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    const plan = await this.plans.findById(planId);
    return this.accounts.detail(
      planId,
      accountId,
      query.month ?? currentMonth(plan!.timeZone),
    );
  }

  @Patch(':accountId')
  @ApiOperation({
    operationId: 'updateAccount',
    summary: 'Edit an account (owner or editor)',
  })
  @planIdParam
  @accountIdParam
  @ApiOkResponse({ description: 'The edited account.', type: AccountDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('accountId', parseUuid('accountId')) accountId: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.accounts.update(planId, accountId, dto);
  }

  @Post(':accountId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveAccount',
    summary: 'Archive an account (owner or editor)',
  })
  @planIdParam
  @accountIdParam
  @ApiOkResponse({ description: 'The archived account.', type: AccountDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @conflict
  async archive(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('accountId', parseUuid('accountId')) accountId: string,
  ): Promise<AccountDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.accounts.archive(planId, accountId);
  }

  @Post(':accountId/restore')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'restoreAccount',
    summary: 'Restore an archived account (owner or editor)',
  })
  @planIdParam
  @accountIdParam
  @ApiOkResponse({ description: 'The restored account.', type: AccountDto })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @conflict
  async restore(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('accountId', parseUuid('accountId')) accountId: string,
  ): Promise<AccountDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.accounts.restore(planId, accountId);
  }
}
