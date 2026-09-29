import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorDto } from '../common/dto/error.dto.js';
import { UserDto } from './dto/user.dto.js';
import type { User } from './entities/user.entity.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  @Get('me')
  @ApiOperation({
    operationId: 'getCurrentUser',
    summary: 'Get the authenticated user',
  })
  @ApiOkResponse({
    description: 'The user the bearer token was issued for.',
    type: UserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
    type: ErrorDto,
  })
  getCurrentUser(@CurrentUser() user: User): UserDto {
    return UserDto.fromEntity(user);
  }
}
