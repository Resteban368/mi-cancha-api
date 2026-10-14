import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthPayload } from './auth-payload.js';

export type AuthenticatedRequest = Request & { user?: AuthPayload };

/** Inyecta el usuario autenticado (payload del JWT). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AuthPayload;
  },
);
