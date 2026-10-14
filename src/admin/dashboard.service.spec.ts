import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService, lastMonths } from './dashboard.service.js';

describe('lastMonths', () => {
  it('devuelve los últimos meses en orden, cruzando el cambio de año', () => {
    expect(lastMonths(new Date('2026-02-15T12:00:00Z'), 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('agrega usuarios por rol, ingresos y altas por mes', async () => {
    prisma.business.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    prisma.subscription.count.mockResolvedValue(4);
    prisma.user.groupBy.mockResolvedValue([
      { role: UserRole.SUPER_ADMIN, _count: { _all: 1 } },
      { role: UserRole.ADMIN_NEGOCIO, _count: { _all: 5 } },
      { role: UserRole.JUGADOR, _count: { _all: 9 } },
    ]);
    prisma.court.count.mockResolvedValue(7);
    prisma.reservation.count.mockResolvedValue(12);
    prisma.subscription.findMany.mockResolvedValue([
      { plan: { monthlyPrice: 89_000 } },
      { plan: { monthlyPrice: 179_000 } },
    ]);
    prisma.plan.findMany.mockResolvedValue([
      { name: 'Gratis', _count: { subscriptions: 1 } },
    ]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ month: '2026-10', count: 2 }])
      .mockResolvedValueOnce([{ month: '2026-09', count: 3 }]);

    const result = await service.getDashboard(new Date('2026-10-14T12:00:00Z'));

    expect(result.clients).toEqual({ total: 5, active: 4, newLast30Days: 2 });
    expect(result.users).toEqual({
      total: 15,
      superAdmins: 1,
      businessAdmins: 5,
      players: 9,
    });
    expect(result.monthlyRecurringRevenue).toBe(268_000);
    expect(result.signupsByMonth).toHaveLength(6);
    expect(result.signupsByMonth.at(-1)).toEqual({
      month: '2026-10',
      clients: 2,
      players: 0,
    });
    expect(result.signupsByMonth.at(-2)).toEqual({
      month: '2026-09',
      clients: 0,
      players: 3,
    });
  });
});
