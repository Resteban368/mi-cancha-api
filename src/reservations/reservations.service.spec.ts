import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
          provide: NotificationsService,
          useValue: { notifyNewReservation: vi.fn() },
        },
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
    const current = {
      id: 'res-1',
      customerId: 'cus-1',
      groupId: null,
      status: ReservationStatus.CONFIRMED,
      payments: [
        { id: 'p1', status: PaymentStatus.APPROVED, amount: 50_000 },
        { id: 'p2', status: PaymentStatus.PENDING, amount: 10_000 },
      ],
    };
    prisma.reservation.findFirst.mockResolvedValue(current);
    prisma.reservation.findMany.mockResolvedValue([current]);
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

  describe('varias canchas a la vez', () => {
    const courtA = { ...court, id: 'court-1', name: 'Sintética 1' };
    const courtB = {
      ...court,
      id: 'court-2',
      name: 'Sintética 2',
      basePricePerHour: 50_000,
      rates: [],
    };
    const byId = { 'court-1': courtA, 'court-2': courtB } as Record<
      string,
      unknown
    >;
    const { courtId: _c, ...base } = dto;

    beforeEach(() => {
      prisma.court.findFirst.mockImplementation(
        ({ where }) => byId[where.id] ?? null,
      );
      prisma.reservationGroup.create.mockResolvedValue({ id: 'g-1' });
      prisma.reservation.create.mockImplementation(({ data }) => ({
        id: `r-${data.courtId}`,
      }));
      prisma.reservation.findUniqueOrThrow.mockRejectedValue(new Error('stop'));
      catalogs.resolvePaymentMethod.mockResolvedValue({
        id: 'm-cash',
        name: 'Efectivo',
        requiresReference: false,
      });
    });

    it('reserva todas en grupo, reparte el descuento y deja el pago en la primera', async () => {
      await expect(
        service.create('owner-1', {
          ...base,
          courtIds: ['court-1', 'court-2'],
          discount: 32_000,
          payment: { amount: 100_000 },
        }),
      ).rejects.toThrow('stop');

      const [a, b] = prisma.reservation.create.mock.calls.map((c) => c[0].data);
      // A: 100.000 + 120.000 = 220.000 · B: 2 × 50.000 = 100.000 · total 320.000
      expect(a).toMatchObject({
        courtId: 'court-1',
        groupId: 'g-1',
        subtotal: 220_000,
        discount: 22_000,
        totalPrice: 198_000,
      });
      expect(b).toMatchObject({
        courtId: 'court-2',
        groupId: 'g-1',
        subtotal: 100_000,
        discount: 10_000,
        totalPrice: 90_000,
      });
      expect(a.start).toEqual(b.start);
      expect(a.end).toEqual(b.end);
      expect(a.payments.create).toMatchObject({
        amount: 100_000,
        concept: 'ANTICIPO',
      });
      expect(b.payments).toBeUndefined();
    });

    it('un descuento en pesos enteros se reparte sin centavos', async () => {
      await expect(
        service.create('owner-1', {
          ...base,
          courtIds: ['court-1', 'court-2'],
          discount: 10_001,
        }),
      ).rejects.toThrow('stop');
      const shares = prisma.reservation.create.mock.calls.map(
        (c) => c[0].data.discount,
      );
      // 10.001 × 220/320 = 6.875,69 → 6.876; el resto, a la última.
      expect(shares).toEqual([6_876, 3_125]);
    });

    it('si una está ocupada no reserva ninguna', async () => {
      prisma.reservation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'otra' });
      await expect(
        service.create('owner-1', {
          ...base,
          courtIds: ['court-1', 'court-2'],
        }),
      ).rejects.toThrow('La cancha Sintética 2 ya está reservada');
      expect(prisma.reservation.create).not.toHaveBeenCalled();
      expect(prisma.reservationGroup.create).not.toHaveBeenCalled();
    });

    it('exige el mismo deporte y la misma duración de turno', async () => {
      byId['court-2'] = { ...courtB, sport: Sport.PADEL };
      await expect(
        service.create('owner-1', { ...base, courtIds: ['court-1', 'court-2'] }),
      ).rejects.toThrow('mismo deporte');
      byId['court-2'] = { ...courtB, slotDuration: 90 };
      await expect(
        service.create('owner-1', { ...base, courtIds: ['court-1', 'court-2'] }),
      ).rejects.toThrow(BadRequestException);
      byId['court-2'] = courtB;
    });

    it('el descuento es sobre el total del grupo', async () => {
      await expect(
        service.create('owner-1', {
          ...base,
          courtIds: ['court-1', 'court-2'],
          discount: 320_001,
        }),
      ).rejects.toThrow('no puede superar el valor de la reserva (320000)');
    });

    it('con sport y courts toma las primeras canchas libres', async () => {
      prisma.court.findMany.mockResolvedValue([courtA, courtB]);
      await expect(
        service.create('owner-1', { ...base, sport: Sport.FUTBOL, courts: 2 }),
      ).rejects.toThrow('stop');
      expect(
        prisma.reservation.create.mock.calls.map((c) => c[0].data.courtId),
      ).toEqual(['court-1', 'court-2']);

      prisma.reservation.create.mockClear();
      prisma.reservation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'otra' });
      await expect(
        service.create('owner-1', { ...base, sport: Sport.FUTBOL, courts: 2 }),
      ).rejects.toThrow('Solo hay 1 cancha(s) de fútbol libres');
    });

    it('pide una sola forma de elegir canchas', async () => {
      await expect(
        service.create('owner-1', {
          ...dto,
          courtIds: ['court-1', 'court-2'],
        }),
      ).rejects.toThrow('uno de los tres');
      await expect(
        service.create('owner-1', { ...dto, courts: 2 }),
      ).rejects.toThrow('courts solo aplica junto con sport');
    });

    it('cancelar una cancha del grupo cancela todas', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'r-1',
        status: ReservationStatus.CONFIRMED,
        groupId: 'g-1',
      });
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'r-1',
          customerId: 'cus-1',
          payments: [
            { id: 'p1', status: PaymentStatus.APPROVED, amount: 80_000 },
          ],
        },
        { id: 'r-2', customerId: 'cus-1', payments: [] },
      ]);
      await expect(
        service.cancel('owner-1', 'r-2', { reason: 'Llueve' }),
      ).rejects.toThrow('stop');
      expect(prisma.reservation.findMany.mock.calls[0][0].where).toEqual({
        groupId: 'g-1',
        status: ReservationStatus.CONFIRMED,
      });
      expect(
        prisma.reservation.update.mock.calls.map((c) => c[0].where.id),
      ).toEqual(['r-1', 'r-2']);
      expect(prisma.payment.update.mock.calls[0][0].data.status).toBe(
        PaymentStatus.REFUNDED,
      );
    });

    it('el estado aplica a todas las canchas del grupo', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'r-1',
        status: ReservationStatus.CONFIRMED,
        groupId: 'g-1',
      });
      await service
        .updateStatus('owner-1', 'r-1', { status: ReservationStatus.COMPLETED })
        .catch(() => undefined);
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          groupId: 'g-1',
          status: { not: ReservationStatus.CANCELLED },
        },
        data: { status: ReservationStatus.COMPLETED },
      });
    });
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

    it('en la web marca HELD lo apartado y no lo cuenta como libre', async () => {
      prisma.court.findMany.mockResolvedValue([court]);
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.slotHold.findMany.mockResolvedValue([
        {
          courtId: 'court-1',
          start: new Date('2030-10-21T18:00:00-05:00'),
          end: new Date('2030-10-21T19:00:00-05:00'),
        },
      ]);

      const result = await service.sportAvailability(
        'biz-1',
        Sport.FUTBOL,
        '2030-10-21',
        now,
        { withHolds: true },
      );

      const slots = result.courts[0].slots;
      const at18 = slots.find(
        (s) => s.start.getTime() === Date.parse('2030-10-21T18:00:00-05:00'),
      );
      expect(at18?.status).toBe('HELD');
      expect(result.courts[0].availableCount).toBe(15);
      expect(prisma.slotHold.findMany.mock.calls[0][0].where).toMatchObject({
        courtId: { in: ['court-1'] },
        expiresAt: { gt: now },
      });
    });

    it('para el negocio no consulta apartados', async () => {
      prisma.court.findMany.mockResolvedValue([court]);
      prisma.reservation.findMany.mockResolvedValue([]);
      await service.sportAvailability('biz-1', Sport.FUTBOL, '2030-10-21', now);
      expect(prisma.slotHold.findMany).not.toHaveBeenCalled();
    });

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
      maxSlots: 3,
      holdMinutes: 3,
    };
    const player = {
      id: 'u-1',
      displayName: 'Pedro',
      phone: '+573120001111',
      documentId: '1098111222',
      favoriteSport: null,
    } as never;
    const input = {
      courtIds: ['court-1'],
      start: '2030-10-21T19:00:00-05:00',
      slots: 1,
      notes: ' Llevamos balón ',
    };
    const now = new Date('2030-10-21T12:00:00Z');

    beforeEach(() => {
      prisma.court.findFirst.mockResolvedValue(court);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.slotHold.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValueOnce({
        id: 'cus-1',
        name: 'Pedro',
        phone: '+573120001111',
      });
      prisma.reservation.findMany.mockResolvedValue([]);
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
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'r-1', groupId: null },
        { id: 'r-2', groupId: null },
      ]);
      await expect(
        service.createWebReservation('biz-1', player, input, rules, now),
      ).rejects.toThrow('máximo 2 reservas por día');
    });

    it('una reserva de varias canchas cuenta como una en el límite diario', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'r-1', groupId: 'g-1' },
        { id: 'r-2', groupId: 'g-1' },
        { id: 'r-3', groupId: 'g-1' },
      ]);
      await expect(
        service.createWebReservation('biz-1', player, input, rules, now),
      ).rejects.toThrow('stop'); // pasa el límite y llega a crear
    });

    it('reserva varias canchas en grupo desde la web', async () => {
      prisma.court.findFirst.mockImplementation(({ where }) => ({
        ...court,
        id: where.id,
        name: where.id === 'court-1' ? 'Sintética 1' : 'Sintética 2',
      }));
      prisma.reservationGroup.create.mockResolvedValue({ id: 'g-1' });
      prisma.reservation.create.mockImplementation(({ data }) => ({
        id: `r-${data.courtId}`,
      }));
      await service
        .createWebReservation(
          'biz-1',
          player,
          { ...input, courtIds: ['court-1', 'court-2'] },
          rules,
          now,
        )
        .catch(() => undefined);
      const rows = prisma.reservation.create.mock.calls.map((c) => c[0].data);
      expect(rows.map((d) => [d.courtId, d.groupId, d.source])).toEqual([
        ['court-1', 'g-1', 'WEB'],
        ['court-2', 'g-1', 'WEB'],
      ]);
      expect(prisma.slotHold.findFirst.mock.calls[0][0].where.courtId).toEqual({
        in: ['court-1', 'court-2'],
      });
    });

    it('rechaza el turno que otro jugador tiene apartado', async () => {
      prisma.slotHold.findFirst.mockResolvedValue({ id: 'h-otro' });
      await expect(
        service.createWebReservation('biz-1', player, input, rules, now),
      ).rejects.toThrow('Otra persona está reservando ese turno');
      const { where } = prisma.slotHold.findFirst.mock.calls[0][0];
      expect(where).toMatchObject({
        courtId: { in: ['court-1'] },
        playerId: { not: 'u-1' },
        expiresAt: { gt: now },
      });
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('al reservar borra el apartado del jugador', async () => {
      prisma.reservation.create.mockResolvedValue({ id: 'r-1' });
      await service
        .createWebReservation('biz-1', player, input, rules, now)
        .catch(() => undefined);
      expect(prisma.slotHold.deleteMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', playerId: 'u-1' },
      });
    });

    it('no permite más turnos seguidos que el máximo de la web', async () => {
      await expect(
        service.createWebReservation(
          'biz-1',
          player,
          { ...input, slots: 4 },
          rules,
          now,
        ),
      ).rejects.toThrow('máximo 3 turnos seguidos');
    });
  });

  describe('holdWebSlots', () => {
    const rules = {
      minAdvanceMinutes: 60,
      maxDaysAhead: 30,
      maxReservationsPerDay: 2,
      maxSlots: 3,
      holdMinutes: 3,
    };
    const input = {
      courtIds: ['court-1'],
      start: '2030-10-21T19:00:00-05:00',
      slots: 2,
    };
    const now = new Date('2030-10-21T12:00:00Z');

    beforeEach(() => {
      prisma.court.findFirst.mockResolvedValue(court);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.slotHold.findFirst.mockResolvedValue(null);
      prisma.slotHold.findMany.mockResolvedValue([]);
    });

    it('aparta los turnos 3 minutos y reemplaza el apartado anterior', async () => {
      await service.holdWebSlots('biz-1', 'u-1', input, rules, now);
      expect(prisma.slotHold.deleteMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', playerId: 'u-1' },
      });
      const { data } = prisma.slotHold.createMany.mock.calls[0][0];
      expect(data).toEqual([
        {
          businessId: 'biz-1',
          playerId: 'u-1',
          courtId: 'court-1',
          start: new Date('2030-10-22T00:00:00Z'),
          end: new Date('2030-10-22T02:00:00Z'),
          slots: 2,
          expiresAt: new Date('2030-10-21T12:03:00Z'),
        },
      ]);
    });

    it('aparta varias canchas en la misma franja, una fila por cancha', async () => {
      prisma.court.findFirst.mockImplementation(({ where }) => ({
        ...court,
        id: where.id,
      }));
      await service.holdWebSlots(
        'biz-1',
        'u-1',
        { ...input, courtIds: ['court-1', 'court-2', 'court-3'] },
        rules,
        now,
      );
      const { data } = prisma.slotHold.createMany.mock.calls[0][0];
      expect(data.map((d: { courtId: string }) => d.courtId)).toEqual([
        'court-1',
        'court-2',
        'court-3',
      ]);
    });

    it('no aparta lo que ya está apartado por otro o reservado', async () => {
      prisma.slotHold.findFirst.mockResolvedValue({ id: 'h-otro' });
      await expect(
        service.holdWebSlots('biz-1', 'u-1', input, rules, now),
      ).rejects.toThrow('Otra persona está reservando ese turno');

      prisma.slotHold.findFirst.mockResolvedValue(null);
      prisma.reservation.findFirst.mockResolvedValue({ id: 'ocupada' });
      await expect(
        service.holdWebSlots('biz-1', 'u-1', input, rules, now),
      ).rejects.toThrow('ya está reservada');
      expect(prisma.slotHold.createMany).not.toHaveBeenCalled();
    });

    it('aplica la anticipación mínima y el máximo de turnos', async () => {
      await expect(
        service.holdWebSlots(
          'biz-1',
          'u-1',
          { ...input, start: '2030-10-21T07:00:00-05:00' },
          rules,
          now,
        ),
      ).rejects.toThrow('al menos 60 minutos');
      await expect(
        service.holdWebSlots('biz-1', 'u-1', { ...input, slots: 4 }, rules, now),
      ).rejects.toThrow('máximo 3 turnos seguidos');
    });

    it('si otro jugador toma el turno a la vez, responde 409 en vez de 500', async () => {
      const writeConflict = Object.assign(new Error('conflict'), {
        name: 'DriverAdapterError',
        cause: { kind: 'TransactionWriteConflict' },
      });
      prisma.$transaction.mockRejectedValueOnce(writeConflict);
      await expect(
        service.holdWebSlots('biz-1', 'u-1', input, rules, now),
      ).rejects.toThrow('Otra persona acaba de tomar ese turno');

      prisma.$transaction.mockRejectedValueOnce(new Error('otra cosa'));
      await expect(
        service.holdWebSlots('biz-1', 'u-1', input, rules, now),
      ).rejects.toThrow('otra cosa');
    });

    it('el apartado vigente ignora los vencidos', async () => {
      await expect(service.currentHold('biz-1', 'u-1', now)).resolves.toEqual(
        [],
      );
      expect(prisma.slotHold.findMany.mock.calls[0][0].where).toEqual({
        businessId: 'biz-1',
        playerId: 'u-1',
        expiresAt: { gt: now },
      });
    });
  });
});
