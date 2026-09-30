import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { WRITE_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionDto } from './dto/transaction.dto.js';
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

@ApiTags('Transactions')
@Controller('plans/:planId/transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly access: PlanAccessService,
  ) {}

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
}
