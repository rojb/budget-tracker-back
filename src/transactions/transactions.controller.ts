import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
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
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { READ_ROLES, WRITE_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import {
  AffectedMonthsDto,
  ListTransactionsQueryDto,
  TransactionChangeDto,
  TransactionDto,
  TransactionPageDto,
} from './dto/transaction.dto.js';
import { TransactionsService } from './transactions.service.js';

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
const transactionIdParam = ApiParam({ name: 'transactionId', format: 'uuid' });

@ApiTags('Transactions')
@Controller('plans/:planId/transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listTransactions',
    summary: 'List transactions (movements)',
    description:
      "Newest first by registration instant, `createdAt` (ties by id): the transaction recorded last comes first, whatever `occurredAt` it carries. `occurredAt` still decides the month, the balances and the date and time filters. Transactions that were deleted are not listed. Every filter is optional and they combine with AND. Dates and times are local to the plan's time zone. `summary` totals every matching transaction (not only the page) with its whole amount. Transfers between accounts are not transactions and are not listed here.",
  })
  @planIdParam
  @ApiOkResponse({
    description: 'A page of transactions.',
    type: TransactionPageDto,
  })
  @badRequest
  @unauthorized
  @notFound
  async list(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionPageDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.transactions.list(planId, query);
  }

  @Post()
  @ApiOperation({
    operationId: 'createTransaction',
    summary: 'Record an expense or an income (owner or editor)',
    description:
      'An expense names its envelope with `envelopeId` or is divided with `splits` (at least two portions that add up exactly to `amountMinor`). An income may name an `envelopeId`; without one it goes to Ready to Assign. The payee is optional: `payeeId` of an active payee or `payeeName`, which reuses the active payee with that name or creates it.',
  })
  @planIdParam
  @ApiCreatedResponse({
    description: 'The transaction was recorded.',
    type: TransactionDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiConflictResponse({
    description: 'The account is archived.',
    type: ErrorDto,
  })
  async create(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.transactions.create(planId, user.id, dto);
  }

  @Put(':transactionId')
  @ApiOperation({
    operationId: 'updateTransaction',
    summary: 'Edit a transaction (owner or editor)',
    description:
      'Replaces every editable field and the portions with the body, which has the same shape and rules as recording one. Sending the previous state back undoes an edit exactly: `id` and `createdAt` never change. The account is validated only when it differs from the current one (`409` if archived) and so is `payeeId` (`404` if deleted). The response lists the months whose figures were recalculated.',
  })
  @planIdParam
  @transactionIdParam
  @ApiOkResponse({
    description: 'The edited transaction.',
    type: TransactionChangeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiConflictResponse({
    description: 'The new account is archived.',
    type: ErrorDto,
  })
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('transactionId', parseUuid('transactionId')) transactionId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionChangeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.transactions.update(planId, transactionId, dto);
  }

  @Delete(':transactionId')
  @ApiOperation({
    operationId: 'deleteTransaction',
    summary: 'Delete a transaction logically (owner or editor)',
    description:
      'The transaction stops counting everywhere (list, summary, balances, activity, payee counts) but is kept, so `restoreTransaction` brings it back exactly. Deleting one that is already deleted is `404`.',
  })
  @planIdParam
  @transactionIdParam
  @ApiOkResponse({
    description:
      'The transaction was deleted; the months whose figures were recalculated.',
    type: AffectedMonthsDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('transactionId', parseUuid('transactionId')) transactionId: string,
  ): Promise<AffectedMonthsDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.transactions.remove(planId, transactionId);
  }

  @Post(':transactionId/restore')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'restoreTransaction',
    summary: 'Restore a deleted transaction (owner or editor)',
    description:
      'Gives back the transaction with the same id, creation instant, amount, account, payee, date, description and portions it had when it was deleted. Restoring one that is not deleted is `404`.',
  })
  @planIdParam
  @transactionIdParam
  @ApiOkResponse({
    description: 'The restored transaction.',
    type: TransactionChangeDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async restore(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('transactionId', parseUuid('transactionId')) transactionId: string,
  ): Promise<TransactionChangeDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.transactions.restore(planId, transactionId);
  }
}
