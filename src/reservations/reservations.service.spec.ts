import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { DAYS } from '../courts/court-time.js';
import { CustomersService } from '../customers/customers.service.js';
import {
  CourtPhotoSlot,
  PaymentStatus,
  ReservationStatus,
  Sport,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReservationsService } from './reservations.service.js';

const court = {
  id: 'court-1',
  name: 'Sintética 1',
  sport: Sport.FUTBOL,
  currency: 'COP',
  basePricePerHour: 100_000,
  slotDuration: 60,
  isActive: true,
  schedules: DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openTime: '06:00',
    closeTime: '23:00',
  })),
  rates: [
    {
      name: 'Nocturna',
      pricePerHour: 120_000,
      days: DAYS,
      startTime: '19:00',
      endTime: '23:00',
    },
  ],
  photos: [
    { slot: CourtPhotoSlot.MAIN },
    { slot: CourtPhotoSlot.SURFACE },
    { slot: CourtPhotoSlot.LIGHTING },
  ],
};

// 2030-10-21 es lunes.
const dto = {
  courtId: 'court-1',
  start: '2030-10-21T18:00:00-05:00',
  slots: 2,
  customer: {
    name: 'Valentina',
    phone: '300 123 4567',
    documentId: '1.117.000',
  },
};

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: PrismaMock;
  const catalogs = { resolvePaymentMethod: vi.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    catalogs.resolvePaymentMethod.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CatalogsService, useValue: catalogs },
        {
          provide: BusinessesService,
          useValue: { requireBusinessId: vi.fn().mockResolvedValue('biz-1') },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('-05:00'),
            get: vi.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ReservationsService);
    prisma.court.findFirst.mockResolvedValue(court);
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({
      id: 'cus-1',
      ...data,
    }));
  });

  it('reserva turnos seguidos, crea el cliente y cobra por fracciones con descuento', async () => {
    catalogs.resolvePaymentMethod.mockResolvedValue({
      id: 'm-cash',
      name: 'Efectivo',
      requiresReference: false,
    });
    prisma.reservation.create.mockRejectedValue(new Error('stop'));

    await expect(
      service.create('owner-1', {
        ...dto,
        discount: 20_000,
        payment: { amount: 50_000 },
      }),
    ).rejects.toThrow('stop');

    expect(prisma.customer.create.mock.calls[0][0].data).toMatchObject({
      phone: '+573001234567',
      documentId: '1117000',
    });
    const { data } = prisma.reservation.create.mock.calls[0][0];
    // 18–19 base (100.000) + 19–20 nocturna (120.000) − 20.000
    expect(data).toMatchObject({
      subtotal: 220_000,
      discount: 20_000,
      totalPrice: 200_000,
      end: new Date('2030-10-21T20:00:00-05:00'),
    });
    expect(data.payments.create).toMatchObject({
      amount: 50_000,
      concept: 'ANTICIPO',
      status: PaymentStatus.APPROVED,
    });
    expect(catalogs.resolvePaymentMethod).toHaveBeenCalledWith('EFECTIVO');
  });

  it('rechaza inicios fuera de los turnos, más turnos de los que caben y cruces', async () => {
    await expect(
      service.create('owner-1', { ...dto, start: '2030-10-21T18:30:00-05:00' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('owner-1', { ...dto, start: '2030-10-21T22:00:00-05:00' }),
    ).rejects.toThrow('No hay 2 turnos seguidos');
    prisma.reservation.findFirst.mockResolvedValue({ id: 'otra' });
    await expect(service.create('owner-1', dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('exige cliente y no deja que el descuento supere el valor', async () => {
    const { customer: _c, ...sinCliente } = dto;
    await expect(service.create('owner-1', sinCliente)).rejects.toThrow(
      'customerId',
    );
    await expect(
      service.create('owner-1', { ...dto, discount: 999_999 }),
    ).rejects.toThrow('El descuento');
  });

  it('cancela devolviendo los pagos aprobados y rechazando los pendientes', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      customerId: 'cus-1',
      status: ReservationStatus.CONFIRMED,
      payments: [
        { id: 'p1', status: PaymentStatus.APPROVED, amount: 50_000 },
        { id: 'p2', status: PaymentStatus.PENDING, amount: 10_000 },
      ],
    });
    prisma.reservation.update.mockRejectedValue(new Error('stop'));

    await expect(
      service.cancel('owner-1', 'res-1', { reason: 'Llueve' }),
    ).rejects.toThrow('stop');

    const [refund, reject] = prisma.payment.update.mock.calls.map((c) => c[0]);
    expect(refund.data).toMatchObject({
      status: PaymentStatus.REFUNDED,
      refund: {
        create: { amount: 50_000, reason: 'Llueve', createdById: 'owner-1' },
      },
    });
    expect(reject.data.status).toBe(PaymentStatus.REJECTED);
    expect(prisma.reservation.update.mock.calls[0][0].data).toMatchObject({
      status: ReservationStatus.CANCELLED,
      cancellationReason: 'Llueve',
    });
  });

  it('solo cancela reservas confirmadas', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      status: ReservationStatus.COMPLETED,
      payments: [],
    });
    await expect(
      service.cancel('owner-1', 'res-1', { reason: 'X' }),
    ).rejects.toThrow('Solo se pueden cancelar');
  });

  describe('list', () => {
    const page = { page: 2, pageSize: 10 };

    it('con date devuelve la agenda del día, en hora local y ordenada', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      await expect(
        service.list('owner-1', { ...page, date: '2030-10-21' }),
      ).resolves.toEqual([]);
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz-1',
            start: {
              gte: new Date('2030-10-21T05:00:00.000Z'),
              lt: new Date('2030-10-22T05:00:00.000Z'),
            },
          }),
          orderBy: { start: 'asc' },
        }),
      );
      expect(prisma.reservation.count).not.toHaveBeenCalled();
    });

    it('sin date pagina con rango, estado, cancha y búsqueda', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.count.mockResolvedValue(35);

      const result = await service.list('owner-1', {
        ...page,
        from: '2030-10-01',
        to: '2030-10-31',
        status: ReservationStatus.CANCELLED,
        courtId: 'court-1',
        search: '1.075',
      });

      expect(result).toEqual({ items: [], total: 35, page: 2, pageSize: 10 });
      const args = prisma.reservation.findMany.mock.calls[0][0];
      expect(args).toMatchObject({
        orderBy: { start: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(args.where).toMatchObject({
        status: ReservationStatus.CANCELLED,
        courtId: 'court-1',
        start: {
          gte: new Date('2030-10-01T05:00:00.000Z'),
          lt: new Date('2030-11-01T05:00:00.000Z'),
        },
      });
      expect(args.where.OR).toContainEqual({
        customer: { documentId: { contains: '1075' } },
      });
    });

    it('rechaza un rango invertido', async () => {
      await expect(
        service.list('owner-1', {
          ...page,
          from: '2030-10-31',
          to: '2030-10-01',
        }),
      ).rejects.toThrow('from no puede ser posterior a to');
    });
  });

  describe('por deporte', () => {
    const courtB = { ...court, id: 'court-2', name: 'Sintética 2' };
    const incomplete = {
      ...court,
      id: 'court-3',
      name: 'Sintética 3',
      photos: [],
    };
    const now = new Date('2030-10-21T12:00:00Z'); // lunes 07:00 en Colombia

    it('trae una tarjeta por cancha reservable con sus turnos y libres', async () => {
      prisma.court.findMany.mockResolvedValue([court, courtB, incomplete]);
      prisma.reservation.findMany.mockResolvedValue([
        {
          courtId: 'court-1',
          start: new Date('2030-10-21T18:00:00-05:00'),
          end: new Date('2030-10-21T20:00:00-05:00'),
        },
      ]);

      const result = await service.sportAvailability(
        'biz-1',
        Sport.FUTBOL,
        '2030-10-21',
        now,
      );

      expect(prisma.court.findMany.mock.calls[0][0].where).toEqual({
        businessId: 'biz-1',
        sport: Sport.FUTBOL,
        isActive: true,
      });
      expect(result.courts.map((c) => c.court.name)).toEqual([
        'Sintética 1',
        'Sintética 2',
      ]);
      // 06:00–23:00 = 17 turnos; a las 07:00 ya pasó el de las 06:00.
      const [a, b] = result.courts;
      expect(a.slots).toHaveLength(17);
      expect(a.slots[0].status).toBe('PAST');
      expect(a.slots.filter((x) => x.status === 'BOOKED')).toHaveLength(2);
      expect(a.availableCount).toBe(14);
      expect(b.availableCount).toBe(16);
    });

    it('asigna la primera cancha libre del deporte', async () => {
      prisma.court.findMany.mockResolvedValue([court, courtB]);
      prisma.reservation.findFirst
        .mockResolvedValueOnce({ id: 'ocupada' })
        .mockResolvedValueOnce(null);
      prisma.reservation.create.mockRejectedValue(new Error('stop'));
      const { courtId: _c, ...byCourt } = dto;

      await expect(
        service.create('owner-1', { ...byCourt, sport: Sport.FUTBOL }),
      ).rejects.toThrow('stop');

      expect(prisma.reservation.create.mock.calls[0][0].data.courtId).toBe(
        'court-2',
      );
    });

    it('responde 409 si todas las canchas del deporte están ocupadas', async () => {
      prisma.court.findMany.mockResolvedValue([court, courtB]);
      prisma.reservation.findFirst.mockResolvedValue({ id: 'ocupada' });
      const { courtId: _c, ...byCourt } = dto;

      await expect(
        service.create('owner-1', { ...byCourt, sport: Sport.FUTBOL }),
      ).rejects.toThrow('No hay canchas de fútbol libres en ese horario');
    });

    it('exige courtId o sport, no ambos', async () => {
      await expect(
        service.create('owner-1', { ...dto, sport: Sport.FUTBOL }),
      ).rejects.toThrow('courtId');
    });
  });

  describe('createWebReservation', () => {
    const rules = {
      minAdvanceMinutes: 60,
      maxDaysAhead: 30,
      maxReservationsPerDay: 2,
    };
    const player = {
      id: 'u-1',
      displayName: 'Pedro',
      phone: '+573120001111',
      documentId: '1098111222',
      favoriteSport: null,
    } as never;
    const input = {
      courtId: 'court-1',
      start: '2030-10-21T19:00:00-05:00',
      slots: 1,
      notes: ' Llevamos balón ',
    };
    const now = new Date('2030-10-21T12:00:00Z');

    beforeEach(() => {
      prisma.court.findFirst.mockResolvedValue(court);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValueOnce({
        id: 'cus-1',
        name: 'Pedro',
        phone: '+573120001111',
      });
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.create.mockRejectedValue(new Error('stop'));
    });

    it('crea la reserva confirmada, sin pago, con origen WEB y la nota', async () => {
      await expect(
        service.createWebReservation('biz-1', player, input, rules, now),
      ).rejects.toThrow('stop');
      const { data } = prisma.reservation.create.mock.calls[0][0];
      expect(data).toMatchObject({
        source: 'WEB',
        playerId: 'u-1',
        customerId: 'cus-1',
        contactNote: 'Llevamos balón',
        discount: 0,
        subtotal: 120_000,
        totalPrice: 120_000,
      });
      expect(data.payments).toBeUndefined();
    });

    it('exige la anticipación mínima y respeta el máximo de días', async () => {
      await expect(
        service.createWebReservation(
          'biz-1',
          player,
          { ...input, start: '2030-10-21T07:00:00-05:00' }, // empieza ya
          { ...rules, minAdvanceMinutes: 60 },
          new Date('2030-10-21T12:00:00Z'),
        ),
      ).rejects.toThrow('al menos 60 minutos');
      await expect(
        service.createWebReservation(
          'biz-1',
          player,
          input,
          { ...rules, maxDaysAhead: 0 },
          new Date('2030-10-20T12:00:00Z'),
        ),
      ).rejects.toThrow('hasta 0 días');
    });

    it('limita las reservas por día del jugador en la sede', async () => {
      prisma.reservation.count.mockResolvedValue(2);
      await expect(
        service.createWebReservation('biz-1', player, input, rules, now),
      ).rejects.toThrow('máximo 2 reservas por día');
    });
  });
});
