import { ConfigService } from '@nestjs/config';
import { createPrismaMock, PrismaMock } from '../../test/support/prisma-mock.js';
import { ReservationStatus, Sport } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PlayerReservationFilter } from './dto/player-history.dto.js';
import { PlayerHistoryService } from './player-history.service.js';

// 2026-10-19 12:00 en Colombia.
const NOW = new Date('2026-10-19T17:00:00Z');
const at = (iso: string) => new Date(iso);

const row = (over: Record<string, unknown> = {}) => ({
  groupId: null,
  status: ReservationStatus.CONFIRMED,
  start: at('2026-10-10T23:00:00Z'),
  end: at('2026-10-11T00:00:00Z'),
  totalPrice: 100_000,
  court: { name: 'Sintética 1', sport: Sport.FUTBOL, currency: 'COP' },
  business: { name: 'El Golazo', slug: 'el-golazo' },
  ...over,
});

describe('PlayerHistoryService', () => {
  let prisma: PrismaMock;
  let service: PlayerHistoryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PlayerHistoryService(
      prisma as unknown as PrismaService,
      { getOrThrow: () => '-05:00' } as unknown as ConfigService,
    );
  });

  describe('estadísticas', () => {
    it('cuenta partidos, horas y gasto; una reserva de varias canchas es un solo partido', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        // Próxima: la más cercana es la que se informa.
        row({ start: at('2026-10-25T23:00:00Z'), end: at('2026-10-26T00:00:00Z') }),
        row({
          start: at('2026-10-22T23:00:00Z'),
          end: at('2026-10-23T00:00:00Z'),
          business: { name: 'La Arena', slug: 'la-arena' },
          court: { name: 'Pádel 2', sport: Sport.PADEL, currency: 'COP' },
        }),
        // Pasados: confirmada que ya pasó, completada y un grupo de dos canchas.
        row(),
        row({ status: ReservationStatus.COMPLETED, start: at('2026-09-05T23:00:00Z'), end: at('2026-09-06T01:00:00Z'), totalPrice: 200_000 }),
        row({ groupId: 'g-1', start: at('2026-10-01T23:00:00Z'), end: at('2026-10-02T00:00:00Z'), totalPrice: 50_000 }),
        row({ groupId: 'g-1', start: at('2026-10-01T23:00:00Z'), end: at('2026-10-02T00:00:00Z'), totalPrice: 50_000, court: { name: 'Sintética 2', sport: Sport.FUTBOL, currency: 'COP' } }),
        row({ status: ReservationStatus.CANCELLED, start: at('2026-10-03T23:00:00Z'), end: at('2026-10-04T00:00:00Z') }),
        row({ status: ReservationStatus.NO_SHOW, start: at('2026-10-04T23:00:00Z'), end: at('2026-10-05T00:00:00Z') }),
      ]);

      const stats = await service.stats('p-1', NOW);

      expect(stats).toMatchObject({
        total: 7,
        played: 3,
        upcoming: 2,
        cancelled: 1,
        noShow: 1,
        hoursPlayed: 4, // 1 + 2 + 1
        spent: 400_000, // 100.000 + 200.000 + 50.000 + 50.000
        currency: 'COP',
        favoriteSport: Sport.FUTBOL,
        topBusiness: { name: 'El Golazo', slug: 'el-golazo', played: 3 },
        bySport: [{ sport: Sport.FUTBOL, played: 3 }],
      });
      expect(stats.next).toMatchObject({
        businessSlug: 'la-arena',
        courtName: 'Pádel 2',
        start: at('2026-10-22T23:00:00Z'),
      });
    });

    it('da la actividad de los últimos 6 meses en hora de Colombia, también los vacíos', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        row({ status: ReservationStatus.COMPLETED, start: at('2026-09-05T23:00:00Z'), end: at('2026-09-06T00:00:00Z') }),
        // 1 de octubre 01:00 UTC = 30 de septiembre 20:00 en Colombia.
        row({ status: ReservationStatus.COMPLETED, start: at('2026-10-01T01:00:00Z'), end: at('2026-10-01T02:00:00Z') }),
        row({ status: ReservationStatus.COMPLETED, start: at('2025-01-05T23:00:00Z'), end: at('2025-01-06T00:00:00Z') }),
      ]);

      const { byMonth } = await service.stats('p-1', NOW);

      expect(byMonth.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
      expect(byMonth.find((m) => m.month === '2026-09')?.played).toBe(2);
      expect(byMonth.find((m) => m.month === '2026-10')?.played).toBe(0);
      // El partido de hace casi dos años no cae en la gráfica pero sí en el total.
      expect(byMonth.reduce((s, m) => s + m.played, 0)).toBe(2);
    });

    it('sin reservas todo está en cero', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      const stats = await service.stats('p-1', NOW);
      expect(stats).toMatchObject({
        total: 0,
        played: 0,
        hoursPlayed: 0,
        spent: 0,
        favoriteSport: null,
        topBusiness: null,
        next: null,
      });
      expect(stats.byMonth).toHaveLength(6);
    });

    it('busca solo las reservas del jugador', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      await service.stats('p-1', NOW);
      expect(prisma.reservation.findMany.mock.calls[0][0].where).toEqual({
        OR: [{ playerId: 'p-1' }, { customer: { userId: 'p-1' } }],
      });
    });
  });

  describe('listado', () => {
    const listRow = (over: Record<string, unknown> = {}) => ({
      id: 'r-1',
      groupId: null,
      courtId: 'c-1',
      court: { name: 'Sintética 1', sport: Sport.FUTBOL, currency: 'COP' },
      business: { name: 'El Golazo', slug: 'el-golazo' },
      customer: null,
      customerName: 'Pedro',
      customerDetail: null,
      phone: '300',
      contactNote: null,
      tag: null,
      isRecurring: false,
      subtotal: 100_000,
      discount: 0,
      totalPrice: 100_000,
      payments: [],
      status: ReservationStatus.CONFIRMED,
      source: 'WEB',
      cancellationReason: null,
      cancelledAt: null,
      cancelledBy: null,
      group: null,
      start: at('2026-10-10T23:00:00Z'),
      end: at('2026-10-11T00:00:00Z'),
      ...over,
    });
    const query = (over: Record<string, unknown> = {}) => ({ page: 1, pageSize: 20, ...over }) as never;

    it('devuelve cada reserva con su sede', async () => {
      prisma.reservation.findMany.mockResolvedValue([listRow()]);
      const page = await service.list('p-1', query(), NOW);
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(page.items[0]).toMatchObject({ id: 'r-1', businessName: 'El Golazo', businessSlug: 'el-golazo', balance: 100_000 });
    });

    it('una reserva de varias canchas sale una sola vez y la paginación cuenta partidos', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        listRow({ id: 'a', groupId: 'g-1' }),
        listRow({ id: 'b', groupId: 'g-1' }),
        listRow({ id: 'c' }),
        listRow({ id: 'd' }),
      ]);
      const first = await service.list('p-1', query({ pageSize: 2 }), NOW);
      expect(first.total).toBe(3);
      expect(first.items.map((i) => i.id)).toEqual(['a', 'c']);
      const second = await service.list('p-1', query({ page: 2, pageSize: 2 }), NOW);
      expect(second.items.map((i) => i.id)).toEqual(['d']);
    });

    it.each([
      [PlayerReservationFilter.UPCOMING, { status: ReservationStatus.CONFIRMED, end: { gt: NOW } }],
      [
        PlayerReservationFilter.PLAYED,
        { OR: [{ status: ReservationStatus.COMPLETED }, { status: ReservationStatus.CONFIRMED, end: { lte: NOW } }] },
      ],
      [PlayerReservationFilter.CANCELLED, { status: ReservationStatus.CANCELLED }],
      [PlayerReservationFilter.NO_SHOW, { status: ReservationStatus.NO_SHOW }],
    ])('el filtro %s consulta el estado correcto', async (status, expected) => {
      prisma.reservation.findMany.mockResolvedValue([]);
      await service.list('p-1', query({ status }), NOW);
      expect(prisma.reservation.findMany.mock.calls[0][0].where.AND).toContainEqual(expected);
    });

    it('filtra por deporte y sede, y "todas" no agrega filtro de estado', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      await service.list('p-1', query({ status: PlayerReservationFilter.ALL, sport: Sport.PADEL, business: 'la-arena' }), NOW);
      const { AND } = prisma.reservation.findMany.mock.calls[0][0].where;
      expect(AND).toHaveLength(3);
      expect(AND).toContainEqual({ court: { sport: Sport.PADEL } });
      expect(AND).toContainEqual({ business: { slug: 'la-arena' } });
    });

    it('las próximas van de la más cercana a la más lejana; el resto, de la más reciente', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      await service.list('p-1', query({ status: PlayerReservationFilter.UPCOMING }), NOW);
      await service.list('p-1', query(), NOW);
      expect(prisma.reservation.findMany.mock.calls[0][0].orderBy[0]).toEqual({ start: 'asc' });
      expect(prisma.reservation.findMany.mock.calls[1][0].orderBy[0]).toEqual({ start: 'desc' });
    });
  });
});
