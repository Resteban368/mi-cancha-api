import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  createPrismaMock,
  PrismaMock,
} from '../../../test/support/prisma-mock.js';
import { UserRole } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPayload } from './auth-payload.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'x'.repeat(32);

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  let prisma: PrismaMock;
  let guard: JwtAuthGuard;
  let request: { headers: Record<string, string>; user?: AuthPayload };

  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const withToken = async (payload: object) => {
    request = {
      headers: { authorization: `Bearer ${await jwt.signAsync(payload)}` },
    };
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    const reflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    guard = new JwtAuthGuard(
      jwt,
      reflector,
      prisma as unknown as PrismaService,
    );
  });

  it('acepta un token de la versión de sesiones actual', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.ADMIN_NEGOCIO,
      tokenVersion: 2,
    });
    await withToken({ sub: 'u1', role: UserRole.ADMIN_NEGOCIO, ver: 2 });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: 'u1',
      role: UserRole.ADMIN_NEGOCIO,
      ver: 2,
    });
  });

  it('rechaza un token de sesiones ya cerradas', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.JUGADOR,
      tokenVersion: 3,
    });
    await withToken({ sub: 'u1', role: UserRole.JUGADOR, ver: 2 });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('acepta tokens anteriores a este cambio mientras no se cierren sesiones', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.JUGADOR,
      tokenVersion: 0,
    });
    await withToken({ sub: 'u1', role: UserRole.JUGADOR });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rechaza el token de un usuario que ya no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await withToken({ sub: 'borrado', role: UserRole.JUGADOR, ver: 0 });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('usa el rol actual de la base, no el del token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.JUGADOR,
      tokenVersion: 0,
    });
    await withToken({ sub: 'u1', role: UserRole.SUPER_ADMIN, ver: 0 });
    await guard.canActivate(context);
    expect(request.user?.role).toBe(UserRole.JUGADOR);
  });

  it('rechaza tokens con otra firma', async () => {
    const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({
      sub: 'u1',
      role: UserRole.SUPER_ADMIN,
    });
    request = { headers: { authorization: `Bearer ${forged}` } };
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token inválido o expirado',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
