import { ConfigService } from '@nestjs/config';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OtpStatsService } from './otp-stats.service.js';

describe('OtpStatsService', () => {
  let prisma: PrismaMock;
  let service: OtpStatsService;
  const now = new Date('2026-10-15T15:00:00Z'); // 10:00 en Colombia

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new OtpStatsService(
      prisma as unknown as PrismaService,
      new ConfigService({ APP_UTC_OFFSET: '-05:00' }),
    );
  });

  it('cuenta los envíos, rellena los días sin códigos y arma el ranking con su cuenta', async () => {
    // Orden de las consultas: hoy, 7 días, 30 días, total, período, verificados.
    prisma.otpCode.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4);
    const last = new Date('2026-10-15T14:00:00Z');
    prisma.otpCode.groupBy
      .mockResolvedValueOnce([
        { phone: '+573001112222', _count: { _all: 5 }, _max: { createdAt: last } },
        { phone: '+573003334444', _count: { _all: 2 }, _max: { createdAt: last } },
      ])
      .mockResolvedValueOnce([
        { phone: '+573001112222', _count: { _all: 3 } },
      ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'n1', displayName: 'Negocio', role: UserRole.ADMIN_NEGOCIO, phone: '+573001112222' },
      { id: 'u1', displayName: 'Ana', role: UserRole.JUGADOR, phone: '+573001112222' },
    ]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ date: '2026-10-14', count: 4 }])
      .mockResolvedValueOnce([
        { ip_hash: 'abcdef1234567890', requests: 7, phones: 3 },
      ]);

    const stats = await service.stats(3, now);

    expect(stats.totals).toEqual({ today: 2, last7Days: 9, last30Days: 30, all: 120 });
    expect(stats.period).toEqual({ requests: 7, verified: 4 });
    // "Hoy" y el período empiezan a las 00:00 de Colombia (05:00 UTC).
    expect(prisma.otpCode.count.mock.calls[0][0].where.createdAt.gte).toEqual(
      new Date('2026-10-15T05:00:00Z'),
    );
    const since = new Date('2026-10-13T05:00:00Z');
    expect(prisma.otpCode.groupBy.mock.calls[0][0].where.createdAt.gte).toEqual(since);
    // El día se calcula en hora de Colombia: la consulta recibe el desfase en minutos.
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([-300, since]);
    expect(stats.daily).toEqual([
      { date: '2026-10-13', count: 0 },
      { date: '2026-10-14', count: 4 },
      { date: '2026-10-15', count: 0 },
    ]);
    expect(stats.topPhones).toEqual([
      {
        phone: '+573001112222',
        requests: 5,
        verified: 3,
        lastRequestAt: last,
        // Si el celular está en un jugador y en un negocio, se muestra el jugador.
        user: { id: 'u1', displayName: 'Ana', role: UserRole.JUGADOR },
      },
      {
        phone: '+573003334444',
        requests: 2,
        verified: 0,
        lastRequestAt: last,
        user: null,
      },
    ]);
    expect(stats.topSources).toEqual([
      { source: 'abcdef12', requests: 7, phones: 3 },
    ]);
  });

  it('sin códigos devuelve todo en cero y no consulta usuarios', async () => {
    prisma.otpCode.count.mockResolvedValue(0);
    prisma.otpCode.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const stats = await service.stats(2, now);

    expect(stats.totals.all).toBe(0);
    expect(stats.daily).toEqual([
      { date: '2026-10-14', count: 0 },
      { date: '2026-10-15', count: 0 },
    ]);
    expect(stats.topPhones).toEqual([]);
    expect(stats.topSources).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.otpCode.groupBy).toHaveBeenCalledTimes(1);
  });
});
