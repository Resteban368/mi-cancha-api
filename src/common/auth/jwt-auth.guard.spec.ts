import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../generated/prisma/enums.js';
import { ACCOUNT_BANNED_CODE, BannedUsersService } from './banned-users.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Public } from './public.decorator.js';

describe('JwtAuthGuard', () => {
  const jwt = { verifyAsync: vi.fn() };
  const banned = { isBanned: vi.fn() };
  const guard = new JwtAuthGuard(
    jwt as unknown as JwtService,
    new Reflector(),
    banned as unknown as BannedUsersService,
  );

  beforeEach(() => {
    jwt.verifyAsync.mockReset().mockResolvedValue({ sub: 'u-1', role: UserRole.JUGADOR });
    banned.isBanned.mockReset().mockResolvedValue(false);
  });

  function context(authorization?: string, handler: () => void = () => undefined) {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { ctx, request };
  }

  it('deja pasar a una cuenta activa y deja su usuario en la petición', async () => {
    const { ctx, request } = context('Bearer token-bueno');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'u-1', role: UserRole.JUGADOR });
    expect(banned.isBanned).toHaveBeenCalledWith('u-1');
  });

  it('corta a una cuenta bloqueada aunque su token siga vigente', async () => {
    banned.isBanned.mockResolvedValue(true);
    const { ctx } = context('Bearer token-bueno');

    const error = await guard.canActivate(ctx).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: ACCOUNT_BANNED_CODE,
    });
  });

  it('sin token o con token inválido responde 401, sin consultar bloqueos', async () => {
    await expect(guard.canActivate(context().ctx)).rejects.toBeInstanceOf(UnauthorizedException);

    jwt.verifyAsync.mockRejectedValue(new Error('expirado'));
    await expect(guard.canActivate(context('Bearer malo').ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(banned.isBanned).not.toHaveBeenCalled();
  });

  it('los endpoints públicos no piden token ni consultan bloqueos', async () => {
    class Controller {
      @Public()
      login() {}
    }
    await expect(guard.canActivate(context(undefined, Controller.prototype.login).ctx)).resolves.toBe(
      true,
    );
    expect(banned.isBanned).not.toHaveBeenCalled();
  });
});
