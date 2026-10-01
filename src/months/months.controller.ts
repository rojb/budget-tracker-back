import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { MonthKey } from '../budget/month-key.js';
import { ErrorDto, ValidationErrorDto } from '../common/dto/error.dto.js';
import { parseUuid } from '../common/pipes/parse-uuid.pipe.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { READ_ROLES, WRITE_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import {
  AssignMoneyRequestDto,
  AssignMoneyResultDto,
  MONTH_PATTERN,
  MonthCloseDto,
  MonthSummaryDto,
} from './dto/month.dto.js';
import { MonthsService } from './months.service.js';
import { ParseMonthPipe } from './parse-month.pipe.js';

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
const monthParam = ApiParam({
  name: 'month',
  description: 'Budget month as YYYY-MM.',
  schema: { type: 'string', pattern: MONTH_PATTERN },
});

@ApiTags('Months')
@Controller('plans/:planId/months/:month')
export class MonthsController {
  constructor(
    private readonly months: MonthsService,
    private readonly access: PlanAccessService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'getMonthSummary',
    summary: 'Get the figures of a budget month',
    description:
      "The figures the budget engine derives for the month: Σ account balances, Σ Available, the amount reserved for later months and the Ready to Assign (for a future month, the current month's), plus the total assigned in the month and how many envelopes are in each state.",
  })
  @planIdParam
  @monthParam
  @ApiOkResponse({
    description: 'The figures of the month.',
    type: MonthSummaryDto,
  })
  @badRequest
  @unauthorized
  @notFound
  async summary(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('month', ParseMonthPipe) month: MonthKey,
  ): Promise<MonthSummaryDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.months.summary(planId, month);
  }

  @Post('assignments')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'assignToEnvelope',
    summary:
      "Add money to an envelope's assignment of a month (owner or editor)",
    description:
      "Adds the amount to the envelope's assignment of the month (any month: past, current or future); a negative amount takes money back. Assigning more than the Ready to Assign is allowed and leaves it negative.",
  })
  @planIdParam
  @monthParam
  @ApiOkResponse({
    description:
      'The month, its Ready to Assign and the updated line of the envelope.',
    type: AssignMoneyResultDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  async assign(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('month', ParseMonthPipe) month: MonthKey,
    @Body() dto: AssignMoneyRequestDto,
  ): Promise<AssignMoneyResultDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.months.assign(planId, month, dto);
  }

  @Get('close')
  @ApiOperation({
    operationId: 'getMonthClose',
    summary: 'Get the close of a month into the next one',
    description:
      "What carries into the next month (positive Available), what is deducted from its Ready to Assign (overspending), the next month's balance, Available and reserved figures, and whether the close was already confirmed.",
  })
  @planIdParam
  @monthParam
  @ApiOkResponse({
    description: 'The close of the month.',
    type: MonthCloseDto,
  })
  @badRequest
  @unauthorized
  @notFound
  async close(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('month', ParseMonthPipe) month: MonthKey,
  ): Promise<MonthCloseDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.months.close(planId, month);
  }

  @Post('close')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'confirmMonthClose',
    summary: 'Confirm the close of an ended month (owner or editor)',
    description:
      'Records that the close of the month was seen; no figure changes. Confirming again changes nothing. Only a month before the current one can be confirmed (`409`).',
  })
  @planIdParam
  @monthParam
  @ApiOkResponse({
    description: 'The close of the month, confirmed.',
    type: MonthCloseDto,
  })
  @badRequest
  @unauthorized
  @forbidden
  @notFound
  @ApiConflictResponse({
    description:
      'The month has not ended yet, so its close cannot be confirmed.',
    type: ErrorDto,
  })
  async confirmClose(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('month', ParseMonthPipe) month: MonthKey,
  ): Promise<MonthCloseDto> {
    await this.access.require(planId, user.id, WRITE_ROLES);
    return this.months.confirmClose(planId, month);
  }
}
