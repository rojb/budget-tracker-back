import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export interface JwtPayload {
  sub: string;
}

// A message string makes Nest emit the full { statusCode, message, error } shape
// (a bare UnauthorizedException() omits `error`).
const unauthorized = () => new UnauthorizedException('Unauthorized');

// Global guard (APP_GUARD): every route requires a valid bearer token unless it is
// marked @Public(). Fails closed: a forgotten decorator means 401, not an open route.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw unauthorized();
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw unauthorized();
    request.user = user;
    return true;
  }
}
