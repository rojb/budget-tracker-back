import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../users/entities/user.entity.js';

export type AuthenticatedRequest = Request & { user?: User };

// The user attached to the request by AuthGuard. Only available on protected routes.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as User;
  },
);
