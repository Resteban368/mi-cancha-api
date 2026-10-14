import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums.js';
import { RolesGuard } from './roles.guard.js';

function contextWith(user?: { sub: string; role: UserRole }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => vi.restoreAllMocks());

  it('deja pasar si el endpoint no declara roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('deja pasar a un rol permitido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.ADMIN_NEGOCIO,
    ]);
    expect(
      guard.canActivate(
        contextWith({ sub: 'u', role: UserRole.ADMIN_NEGOCIO }),
      ),
    ).toBe(true);
  });

  it('bloquea a un jugador en rutas de negocio', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.ADMIN_NEGOCIO,
    ]);
    expect(() =>
      guard.canActivate(contextWith({ sub: 'u', role: UserRole.JUGADOR })),
    ).toThrow(ForbiddenException);
  });
});
