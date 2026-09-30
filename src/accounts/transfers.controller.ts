import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
  CreateTransferDto,
  ListTransfersQueryDto,
  TransferDto,
  TransferPageDto,
} from './dto/transfer.dto.js';
import { TransfersService } from './transfers.service.js';

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

@ApiTags('Accounts')
@Controller('plans/:planId/transfers')
export class TransfersController {
  constructor(
    private readonly transfers: TransfersService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listTransfers',
    summary: 'List transfers between accounts',
  })
  @planIdParam
  @ApiOkResponse({ description: 'A page of transfers.', type: TransferPageDto })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ListTransfersQueryDto,
  ): Promise<TransferPageDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.transfers.list(planId, query);
  }

  @Post()
  @ApiOperation({
    operationId: 'createTransfer',
    summary: 'Move money between two accounts (owner or editor)',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The transfer was recorded.',
    type: TransferDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiConflictResponse({
    description: 'One of the accounts is archived.',
    type: ErrorDto,
  })
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.transfers.create(planId, user.id, dto);
  }

  @Delete(':transferId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteTransfer',
    summary: 'Delete a transfer (owner or editor)',
  })
  @planIdParam
  @ApiParam({ name: 'transferId', format: 'uuid' })
  @ApiNoContentResponse({
    description: 'The transfer was deleted and both balances restored.',
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('transferId', parseUuid('transferId')) transferId: string,
  ): Promise<void> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    await this.transfers.remove(planId, transferId);
  }
}
