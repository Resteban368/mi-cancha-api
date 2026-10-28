import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { DAYS } from '../courts/court-time.js';
import { DayOfWeek, Sport } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  BusinessDashboardService,
  openHours,
} from './business-dashboard.service.js';

// 2026-10-15 12:00 UTC = jueves 07:00 en Colombia.
const now = new Date('2026-10-15T12:00:00Z');
const PREVIOUS_FROM = new Date('2026-10-02T05:00:00Z');

describe('BusinessDashboardService', () => {
  let prisma: PrismaMock;
  let service: BusinessDashboardService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BusinessDashboardService(
      prisma as unknown as PrismaService,
      new ConfigService({ APP_UTC_OFFSET: '-05:00' }),
    );
  });

  describe('resolvePeriod', () => {
    it('calcula los períodos fijos y su período anterior', () => {
      expect(service.resolvePeriod({}, now)).toEqual({
        type: 'TODAY',
        from: '2026-10-15',
        to: '2026-10-15',
        days: 1,
        previousFrom: '2026-10-14',
        previousTo: '2026-10-14',
      });
      expect(
        service.resolvePeriod({ period: 'LAST_7_DAYS' }, now),
      ).toMatchObject({
        from: '2026-10-09',
        days: 7,
        previousFrom: '2026-10-02',
        previousTo: '2026-10-08',
      });
      expect(
        service.resolvePeriod({ period: 'THIS_MONTH' }, now),
      ).toMatchObject({
        from: '2026-10-01',
        to: '2026-10-15',
        days: 15,
        previousFrom: '2026-09-16',
      });
    });

    it('usa la fecha local, no la UTC', () => {
      // 2026-10-16 03:00 UTC sigue siendo el 15 en Colombia.
      expect(
        service.resolvePeriod({}, new Date('2026-10-16T03:00:00Z')).from,
      ).toBe('2026-10-15');
    });

    it('valida el rango personalizado', () => {
      expect(() =>
        service.resolvePeriod(
          { period: 'CUSTOM', from: '2026-10-31', to: '2026-10-01' },
          now,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        service.resolvePeriod(
          { period: 'CUSTOM', from: '2025-01-01', to: '2026-10-31' },
          now,
        ),
      ).toThrow('El período no puede superar 366 días');
    });
  });

  it('openHours suma las horas abiertas, incluidas las que pasan de medianoche', () => {
    const schedules = DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      isOpen: dayOfWeek !== DayOfWeek.SUNDAY,
      openTime: dayOfWeek === DayOfWeek.FRIDAY ? '18:00' : '06:00',
      closeTime: dayOfWeek === DayOfWeek.FRIDAY ? '02:00' : '23:00',
    }));
    // Jueves 17 h + viernes 8 h + sábado 17 h + domingo cerrado.
    expect(
      openHours(schedules, [
        '2026-10-15',
        '2026-10-16',
        '2026-10-17',
        '2026-10-18',
      ]),
    ).toBe(42);
  });

  it('arma el dashboard con lo que calcula la base de datos', async () => {
    const counts = (total: number) => ({
      total,
      confirmed: 6,
      completed: 2,
      noShow: 1,
      cancelled: 1,
      booked: 800_000,
      discounts: 10_000,
      pendingBalance: 300_000,
      consumptions: 160_000,
      pendingConsumptions: 40_000,
    });
    prisma.$queryRaw.mockImplementation(
      ({ sql, values }: { sql: string; values: unknown[] }) => {
        // El período anterior (últimos 7 días) empieza el 2 de octubre en Colombia.
        const previous = values.some(
          (v) => v instanceof Date && v.getTime() === PREVIOUS_FROM.getTime(),
        );
        if (sql.includes('"pendingBalance"'))
          return Promise.resolve([counts(previous ? 8 : 10)]);
        if (sql.includes('pm."code"'))
          return Promise.resolve(
            previous
              ? [
                  {
                    code: 'EFECTIVO',
                    name: 'Efectivo',
                    count: 1,
                    amount: 100_000,
                  },
                ]
              : [
                  { code: 'NEQUI', name: 'Nequi', count: 3, amount: 300_000 },
                  {
                    code: 'EFECTIVO',
                    name: 'Efectivo',
                    count: 1,
                    amount: 100_000,
                  },
                ],
          );
        if (sql.includes('p."status" = \'PENDING\''))
          return Promise.resolve([{ count: 2, amount: 70_000 }]);
        if (sql.includes('"hours"'))
          return Promise.resolve([
            {
              courtId: 'c-1',
              reservations: 8,
              hours: previous ? 7 : 14,
              booked: 800_000,
            },
          ]);
        if (sql.includes('"isoDow"'))
          return Promise.resolve([
            { isoDow: 4, hour: 19, reservations: 5, booked: 500_000 },
            { isoDow: 4, hour: 20, reservations: 3, booked: 300_000 },
            { isoDow: 6, hour: 10, reservations: 1, booked: 0 },
          ]);
        if (sql.includes('"Customer" c'))
          return Promise.resolve([
            {
              id: 'cu-1',
              name: 'Laura',
              phone: '+57300',
              reservations: 4,
              paid: 200_000,
            },
          ]);
        if (sql.includes('co."sport"::text AS "sport"'))
          return Promise.resolve([
            { sport: Sport.FUTBOL, reservations: 9, booked: 800_000 },
          ]);
        if (sql.includes('"Refund"'))
          return Promise.resolve([{ count: 1, amount: 50_000 }]);
        if (sql.includes('"Product" pr'))
          return Promise.resolve([
            { productId: 'p-1', name: 'Gatorade', units: 24, amount: 120_000 },
            { productId: null, name: 'Agua', units: 10, amount: 25_000 },
          ]);
        if (sql.includes('to_char'))
          return Promise.resolve([
            { date: '2026-10-14', walkIn: 15_000, consumptions: 130_000 },
          ]);
        if (sql.includes('"walkIn"'))
          return Promise.resolve([
            previous
              ? { count: 2, units: 8, total: 100_000, walkIn: 20_000 }
              : { count: 5, units: 34, total: 145_000, walkIn: 15_000 },
          ]);
        return Promise.resolve([]);
      },
    );
    prisma.court.findMany.mockResolvedValue([
      {
        id: 'c-1',
        name: 'Sintética 1',
        sport: Sport.FUTBOL,
        currency: 'COP',
        schedules: DAYS.map((dayOfWeek) => ({
          dayOfWeek,
          isOpen: true,
          openTime: '06:00',
          closeTime: '16:00',
        })),
      },
    ]);
    prisma.customer.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);

    const result = await service.getDashboard(
      'biz-1',
      { period: 'LAST_7_DAYS', sport: Sport.FUTBOL },
      now,
    );

    expect(result.summary).toMatchObject({
      reservations: { value: 10, previous: 8, changePct: 25 },
      collected: { value: 400_000, previous: 100_000, changePct: 300 },
      // 14 h reservadas de 70 h abiertas (7 días × 10 h).
      occupancyPct: { value: 20, previous: 10, changePct: 100 },
      bookedHours: 14,
      openHours: 70,
      averageTicket: 100_000,
      newCustomers: { value: 4, previous: 2, changePct: 100 },
      cancellationRate: 10,
      noShowRate: 10,
      pendingPayments: { count: 2, amount: 70_000 },
      refunds: { count: 1, amount: 50_000 },
    });
    expect(result.occupancyByCourt).toEqual([
      {
        courtId: 'c-1',
        name: 'Sintética 1',
        sport: Sport.FUTBOL,
        reservations: 8,
        bookedHours: 14,
        openHours: 70,
        occupancyPct: 20,
        booked: 800_000,
      },
    ]);
    expect(result.byWeekday).toHaveLength(7);
    expect(result.byWeekday[3]).toEqual({
      dayOfWeek: DayOfWeek.THURSDAY,
      reservations: 8,
      booked: 800_000,
    });
    expect(result.heatmap[0]).toEqual({
      dayOfWeek: DayOfWeek.THURSDAY,
      hour: 19,
      reservations: 5,
    });
    expect(result.heatmapMax).toBe(5);
    expect(result.paymentMethods[0]).toEqual({
      code: 'NEQUI',
      name: 'Nequi',
      count: 3,
      amount: 300_000,
      pct: 75,
    });
    expect(result.sales).toMatchObject({
      total: { value: 145_000, previous: 100_000, changePct: 45 },
      walkIn: 15_000,
      consumptions: 130_000,
      count: 5,
      units: 34,
      // 160.000 en consumos ÷ 8 reservas confirmadas y jugadas.
      averageConsumption: 20_000,
      pendingConsumptions: 40_000,
    });
    expect(result.sales.topProducts[0]).toEqual({
      productId: 'p-1',
      name: 'Gatorade',
      units: 24,
      amount: 120_000,
    });
    // Los 7 días del período, con ceros donde no hubo ventas.
    expect(result.sales.byDay).toHaveLength(7);
    expect(result.sales.byDay[0]).toEqual({
      date: '2026-10-09',
      walkIn: 0,
      consumptions: 0,
    });
    expect(result.sales.byDay[5]).toEqual({
      date: '2026-10-14',
      walkIn: 15_000,
      consumptions: 130_000,
    });
    expect(prisma.court.findMany.mock.calls[0][0].where).toEqual({
      businessId: 'biz-1',
      isActive: true,
      sport: Sport.FUTBOL,
      id: undefined,
    });
  });
});
