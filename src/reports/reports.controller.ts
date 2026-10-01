import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { READ_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import {
  IncomeExpenseReportDto,
  NetWorthReportDto,
  ReportRangeQueryDto,
  SpendingReportDto,
} from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

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
const planIdParam = ApiParam({ name: 'planId', format: 'uuid' });
const ok = 'One entry per month of the range, oldest first.';

@ApiTags('Reports')
@Controller('plans/:planId/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly access: PlanAccessService,
  ) {}

  @Get('spending')
  @ApiOperation({
    operationId: 'getSpendingReport',
    summary: 'Spending by envelope per month',
    description:
      "For each month of the range, the money spent from each envelope (expense portions minus income sent to it, in the plan's time zone), envelopes with spending above zero only, largest first, and the month total.",
  })
  @planIdParam
  @ApiOkResponse({ description: ok, type: SpendingReportDto })
  @badRequest
  @unauthorized
  @notFound
  async spending(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ReportRangeQueryDto,
  ): Promise<SpendingReportDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.reports.spending(planId, query);
  }

  @Get('income-expense')
  @ApiOperation({
    operationId: 'getIncomeExpenseReport',
    summary: 'Income and expenses per month',
    description:
      'For each month of the range, the sum of the income and of the expense transactions of the plan. Transfers between accounts count as neither.',
  })
  @planIdParam
  @ApiOkResponse({ description: ok, type: IncomeExpenseReportDto })
  @badRequest
  @unauthorized
  @notFound
  async incomeExpense(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ReportRangeQueryDto,
  ): Promise<IncomeExpenseReportDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.reports.incomeExpense(planId, query);
  }

  @Get('net-worth')
  @ApiOperation({
    operationId: 'getNetWorthReport',
    summary: 'Net worth at the end of each month',
    description:
      'For each month of the range, the sum of the balances of the active accounts at the end of the month.',
  })
  @planIdParam
  @ApiOkResponse({ description: ok, type: NetWorthReportDto })
  @badRequest
  @unauthorized
  @notFound
  async netWorth(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Query() query: ReportRangeQueryDto,
  ): Promise<NetWorthReportDto> {
    await this.access.require(planId, user.id, READ_ROLES);
    return this.reports.netWorth(planId, query);
  }
}
