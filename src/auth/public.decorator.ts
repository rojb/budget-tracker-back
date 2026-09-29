import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

// Opts a route or controller out of the global AuthGuard. It also marks the operation
// public in the exported spec (`security: []`, normalized in openapi.ts), so runtime
// behavior and contract cannot disagree.
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}));
