import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../../test/support/prisma-mock.js';
import { UserRole } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ActiveSubscriptionGuard } from './active-subscription.guard.js';

function contextWith(
  method: string,
  role: UserRole = UserRole.ADMIN_NEGOCIO,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, user: { sub: 'owner-1', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('ActiveSubscriptionGuard', () => {
  let prisma: PrismaMock;
  let guard: ActiveSubscriptionGuard;

  beforeEach(() => {
    prisma = createPrismaMock();
    guard = new ActiveSubscriptionGuard(prisma as unknown as PrismaService);
  });

  it('siempre permite consultar, aunque el plan esté suspendido', async () => {
    await expect(guard.canActivate(contextWith('GET'))).resolves.toBe(true);
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it('no afecta al super admin', async () => {
    await expect(
      guard.canActivate(contextWith('PATCH', UserRole.SUPER_ADMIN)),
    ).resolves.toBe(true);
  });

  it('permite escribir con el plan activo', async () => {
    prisma.business.findUnique.mockResolvedValue({
      subscription: { isActive: true },
    });
    await expect(guard.canActivate(contextWith('POST'))).resolves.toBe(true);
  });

  it('permite registrar el negocio si aún no existe', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(contextWith('PUT'))).resolves.toBe(true);
  });

  it.each([
    ['suspendido', { isActive: false }],
    ['sin plan', null],
  ])(
    'bloquea crear, editar y borrar con el plan %s',
    async (_label, subscription) => {
      prisma.business.findUnique.mockResolvedValue({ subscription });
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const error = await guard
          .canActivate(contextWith(method))
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          code: 'SUBSCRIPTION_INACTIVE',
        });
      }
    },
  );

  it('permite escribir durante la prueba gratuita', async () => {
    prisma.business.findUnique.mockResolvedValue({
      subscription: {
        isActive: true,
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    });
    await expect(guard.canActivate(contextWith('POST'))).resolves.toBe(true);
  });

  it('con la prueba vencida solo deja consultar y avisa con TRIAL_EXPIRED', async () => {
    prisma.business.findUnique.mockResolvedValue({
      subscription: {
        isActive: true,
        trialEndsAt: new Date(Date.now() - 1000),
      },
    });
    const error = await guard
      .canActivate(contextWith('POST'))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'TRIAL_EXPIRED',
    });
    await expect(guard.canActivate(contextWith('GET'))).resolves.toBe(true);
  });
});
