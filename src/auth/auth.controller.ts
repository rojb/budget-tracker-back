import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AuthSessionDto } from './dto/auth-session.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ operationId: 'register', summary: 'Create an account' })
  @ApiCreatedResponse({
    description: 'The account was created.',
    type: AuthSessionDto,
  })
  @ApiBadRequestResponse({ description: 'The request failed validation.' })
  @ApiConflictResponse({
    description: 'An account with that email already exists.',
  })
  register(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Sign in' })
  @ApiOkResponse({
    description: 'The credentials are valid.',
    type: AuthSessionDto,
  })
  @ApiBadRequestResponse({ description: 'The request failed validation.' })
  @ApiUnauthorizedResponse({ description: 'Wrong email or password.' })
  login(@Body() dto: LoginDto): Promise<AuthSessionDto> {
    return this.auth.login(dto);
  }
}
