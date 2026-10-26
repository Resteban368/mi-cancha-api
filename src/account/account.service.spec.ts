import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountService } from './account.service.js';

describe('AccountService', () => {
  let service: AccountService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AccountService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AccountService);

    prisma.user.findUnique.mockResolvedValue({
      displayName: 'Andrés',
      email: 'a@b.co',
      phone: null,
      role: UserRole.ADMIN_NEGOCIO,
      verified: true,
      business: {
        _count: { courts: 1 },
        subscription: {
          since: new Date('2026-01-01'),
          nextPayment: new Date('2026-11-01'),
          isActive: true,
          autoBilling: false,
          trialEndsAt: null,
          plan: {
            name: 'Básico',
            monthlyPrice: 89_000,
            courtLimit: 3,
            benefits: [],
          },
        },
      },
    });
  });

  it('ofrece el plan más barato que cuesta más que el actual', async () => {
    prisma.plan.findFirst.mockResolvedValue({ name: 'Pro' });

    const account = await service.getAccount('u1');

    expect(account.subscription?.nextPlanName).toBe('Pro');
    expect(prisma.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthlyPrice: { gt: 89_000 } },
        orderBy: [{ monthlyPrice: 'asc' }, { courtLimit: 'asc' }],
      }),
    );
  });

  it('sin un plan más caro no ofrece cambio', async () => {
    prisma.plan.findFirst.mockResolvedValue(null);

    const account = await service.getAccount('u1');

    expect(account.subscription?.nextPlanName).toBeNull();
  });
});
