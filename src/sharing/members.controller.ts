import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { PlanMemberDto } from '../plans/dto/plan.dto.js';
import { PlanAccessService } from '../plans/plan-access.service.js';
import { OWNER_ROLES, READ_ROLES } from '../plans/plan-role.js';
import type { User } from '../users/entities/user.entity.js';
import { UpdateMemberDto } from './dto/sharing.dto.js';
import { SharingService } from './sharing.service.js';

const errors = [
  ApiBadRequestResponse({
    description: 'The request failed validation.',
    type: ValidationErrorDto,
  }),
  ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  }),
  ApiForbiddenResponse({
    description: "The caller's role in the plan does not allow this operation.",
    type: ErrorDto,
  }),
  ApiNotFoundResponse({
    description: 'The resource does not exist.',
    type: ErrorDto,
  }),
  ApiConflictResponse({
    description: "The plan owner's membership cannot be changed or removed.",
    type: ErrorDto,
  }),
];
const decorate =
  (...decorators: MethodDecorator[]): MethodDecorator =>
  (target, key, descriptor) => {
    for (const decorator of decorators) decorator(target, key, descriptor);
  };

@ApiTags('Sharing')
@Controller('plans/:planId/members/:userId')
export class MembersController {
  constructor(
    private readonly sharing: SharingService,
    private readonly access: PlanAccessService,
  ) {}

  @Patch()
  @ApiOperation({
    operationId: 'updateMember',
    summary: "Change a member's role (owner only)",
  })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({
    description: 'The member with the new role.',
    type: PlanMemberDto,
  })
  @decorate(...errors)
  async update(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('userId', parseUuid('userId')) userId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<PlanMemberDto> {
    await this.access.require(planId, user.id, OWNER_ROLES);
    return this.sharing.updateMember(planId, userId, dto.role);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeMember',
    summary: 'Remove a member (owner) or leave the plan (the member themself)',
  })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The membership was removed.' })
  @decorate(...errors)
  async remove(
    @CurrentUser() user: User,
    @Param('planId', parseUuid('planId')) planId: string,
    @Param('userId', parseUuid('userId')) userId: string,
  ): Promise<void> {
    const caller = await this.access.require(planId, user.id, READ_ROLES);
    await this.sharing.removeMember(planId, user.id, caller.role, userId);
  }
}
