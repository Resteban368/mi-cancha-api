import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import {
  PaymentConcept,
  PaymentStatus,
  ReservationStatus,
  Sport,
} from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from './customers.service.js';

const input = {
  name: 'Laura Gómez',
  phone: '+57 311-555 0001',
  documentId: '1.075.111.222',
};

describe('CustomersService.resolve', () => {
  let prisma: PrismaMock;
  let service: CustomersService;
  let db: Parameters<CustomersService['resolve']>[0];

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
    db = prisma as unknown as typeof db;
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({
      id: 'c-new',
      ...data,
    }));
  });

  it('crea el cliente con teléfono y cédula normalizados', async () => {
    await service.resolve(db, 'biz-1', { customer: input });
    expect(prisma.customer.create.mock.calls[0][0].data).toEqual({
      businessId: 'biz-1',
      name: 'Laura Gómez',
      phone: '+573115550001',
      documentId: '1075111222',
    });
  });

  it('reutiliza el existente y conserva sus datos', async () => {
    const existing = { id: 'c-1', name: 'Laura', phone: '+573115550001' };
    prisma.customer.findUnique.mockResolvedValueOnce(existing);
    await expect(
      service.resolve(db, 'biz-1', {
        customer: { ...input, name: 'Otra' },
      }),
    ).resolves.toBe(existing);
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('rechaza teléfono y cédula de clientes distintos', async () => {
    prisma.customer.findUnique
      .mockResolvedValueOnce({ id: 'c-1', name: 'Laura' })
      .mockResolvedValueOnce({ id: 'c-2', name: 'Pedro' });
    await expect(
      service.resolve(db, 'biz-1', { customer: input }),
    ).rejects.toThrow(ConflictException);
  });

  it('busca por id dentro del negocio', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.resolve(db, 'biz-1', { customerId: 'c-x' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'c-x', businessId: 'biz-1' },
    });
  });
});

describe('CustomersService.findPaginated', () => {
  let prisma: PrismaMock;
  let service: CustomersService;
  const now = new Date('2026-10-15T12:00:00Z');

  const reservation = (
    status: ReservationStatus,
    start: string,
    totalPrice: number,
    paid = 0,
  ) => ({
    status,
    start: new Date(start),
    totalPrice,
    court: { name: 'Sintética 1', sport: Sport.FUTBOL },
    payments: paid ? [{ amount: paid, status: PaymentStatus.APPROVED }] : [],
  });

  const customer = (
    id: string,
    name: string,
    createdAt: string,
    reservations: ReturnType<typeof reservation>[],
  ) => ({
    id,
    name,
    phone: `+57311000000${id.slice(-1)}`,
    documentId: `10${id.slice(-1)}`,
    preferredSport: null,
    notes: null,
    createdAt: new Date(createdAt),
    reservations,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
    prisma.court.findFirst.mockResolvedValue({ currency: 'COP' });
    prisma.customer.findMany.mockResolvedValue([
      // 5 reservas: frecuente, debe 40.000 de la confirmada.
      customer('c-1', 'Andrés', '2026-08-01', [
        ...Array.from({ length: 3 }, () =>
          reservation(
            ReservationStatus.COMPLETED,
            '2026-10-01T23:00:00Z',
            100_000,
            100_000,
          ),
        ),
        reservation(ReservationStatus.NO_SHOW, '2026-10-05T23:00:00Z', 100_000),
        reservation(
          ReservationStatus.CONFIRMED,
          '2026-10-20T23:00:00Z',
          100_000,
          60_000,
        ),
        reservation(
          ReservationStatus.CANCELLED,
          '2026-10-21T23:00:00Z',
          100_000,
        ),
      ]),
      // Nueva este mes, 1 reserva jugada.
      customer('c-2', 'Beatriz', '2026-10-10', [
        reservation(
          ReservationStatus.COMPLETED,
          '2026-10-12T23:00:00Z',
          80_000,
          80_000,
        ),
      ]),
      // Registrada el mes anterior, sin reservas.
      customer('c-3', 'Camila', '2026-09-20', []),
    ]);
  });

  it('calcula nivel, asistencia, invertido, saldo, última visita y el resumen', async () => {
    const result = await service.findPaginated(
      'biz-1',
      { page: 1, pageSize: 10 },
      now,
    );

    expect(result.items.map((c) => c.name)).toEqual([
      'Andrés',
      'Beatriz',
      'Camila',
    ]);
    expect(result.items[0].metrics).toEqual({
      reservations: 5,
      level: 'FREQUENT',
      attendancePct: 75,
      totalSpent: 360_000,
      balance: 40_000,
      lastVisit: {
        date: new Date('2026-10-01T23:00:00Z'),
        courtName: 'Sintética 1',
      },
      favoriteSport: Sport.FUTBOL,
    });
    expect(result.items[2].metrics).toMatchObject({
      level: 'NEW',
      attendancePct: null,
      lastVisit: null,
      favoriteSport: null,
    });
    expect(result.overview).toEqual({
      totalCustomers: 3,
      newThisMonth: 1,
      newVsLastMonthPct: 0,
      loyalCustomers: 1,
      loyalPct: 33,
      totalReservations: 6,
      pendingBalance: 40_000,
      currency: 'COP',
    });
  });

  it('filtra por segmento y búsqueda, ordena y pagina', async () => {
    const withBalance = await service.findPaginated(
      'biz-1',
      { page: 1, pageSize: 10, segment: 'WITH_BALANCE' },
      now,
    );
    expect(withBalance.items.map((c) => c.name)).toEqual(['Andrés']);

    const recent = await service.findPaginated(
      'biz-1',
      { page: 1, pageSize: 10, segment: 'NEW', sort: 'NAME' },
      now,
    );
    expect(recent.items.map((c) => c.name)).toEqual(['Beatriz', 'Camila']);

    const byDocument = await service.findPaginated(
      'biz-1',
      { page: 1, pageSize: 10, search: '1.02' },
      now,
    );
    expect(byDocument.items.map((c) => c.name)).toEqual(['Beatriz']);

    const second = await service.findPaginated(
      'biz-1',
      { page: 2, pageSize: 2, sort: 'TOP_SPENDERS' },
      now,
    );
    expect(second).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(second.items.map((c) => c.name)).toEqual(['Camila']);
  });
});

describe('CustomersService.create / update', () => {
  let prisma: PrismaMock;
  let service: CustomersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({
      id: 'c-new',
      createdAt: new Date(),
      ...data,
    }));
    prisma.customer.update.mockImplementation(({ data }) => ({
      id: 'c-1',
      createdAt: new Date(),
      ...data,
    }));
  });

  it('crea con teléfono +57, cédula limpia y notas recortadas', async () => {
    const result = await service.create('biz-1', {
      name: ' Carlos ',
      phone: '311 456 7890',
      documentId: '1.020.334.881',
      preferredSport: Sport.PADEL,
      notes: '  ',
    });
    expect(prisma.customer.create.mock.calls[0][0].data).toEqual({
      businessId: 'biz-1',
      name: 'Carlos',
      phone: '+573114567890',
      documentId: '1020334881',
      preferredSport: Sport.PADEL,
      notes: null,
    });
    expect(result.phone).toBe('+573114567890');
  });

  it('rechaza teléfono o cédula repetidos', async () => {
    prisma.customer.findUnique.mockResolvedValueOnce({
      id: 'otro',
      name: 'Laura',
    });
    await expect(
      service.create('biz-1', {
        name: 'X X',
        phone: '3115550001',
        documentId: '99999',
      }),
    ).rejects.toThrow('Ya existe un cliente con ese teléfono: Laura');
  });

  it('edita solo lo enviado y permite conservar su propio teléfono', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1', name: 'Laura' });
    prisma.customer.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      name: 'Laura',
    });

    await service.update('biz-1', 'c-1', {
      phone: '3115550001',
      notes: 'Paga siempre por Nequi',
      preferredSport: null,
    });

    expect(prisma.customer.update.mock.calls[0][0].data).toEqual({
      name: undefined,
      phone: '+573115550001',
      documentId: undefined,
      preferredSport: null,
      notes: 'Paga siempre por Nequi',
    });
  });

  it('lanza 404 al editar un cliente de otro negocio', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.update('biz-1', 'c-x', { name: 'Ana' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CustomersService.findOneDetail', () => {
  let prisma: PrismaMock;
  let service: CustomersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  it('arroja NotFoundException si el cliente no existe', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(service.findOneDetail('biz-1', 'c-not-found')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna la ficha completa con reservas, pagos y estadísticas', async () => {
    const customer = {
      id: 'c-1',
      businessId: 'biz-1',
      name: 'Valentina Dussán',
      phone: '3001234567',
      documentId: '1117523456',
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-01-10'),
    };
    prisma.customer.findFirst.mockResolvedValue(customer);

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'res-1',
        court: {
          id: 'court-1',
          name: 'Cancha Sintética 1',
          sport: Sport.FUTBOL,
          currency: 'COP',
        },
        cancelledBy: null,
        start: new Date('2026-02-01T18:00:00Z'),
        end: new Date('2026-02-01T19:00:00Z'),
        customerName: 'Valentina Dussán',
        customerDetail: null,
        phone: '3001234567',
        contactNote: null,
        tag: null,
        isRecurring: false,
        subtotal: 80000,
        discount: 10000,
        totalPrice: 70000,
        status: ReservationStatus.CONFIRMED,
        cancellationReason: null,
        cancelledAt: null,
        createdAt: new Date('2026-01-20'),
        payments: [
          {
            id: 'pay-1',
            amount: 70000,
            method: { code: 'NEQUI' },
            concept: PaymentConcept.TOTAL,
            status: PaymentStatus.APPROVED,
            reference: 'M123456',
            note: null,
            rejectionReason: null,
            registeredByBusiness: true,
            receivedAt: new Date('2026-01-20T10:00:00Z'),
            refund: null,
          },
        ],
        refunds: [],
      },
    ]);

    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        amount: 70000,
        method: { code: 'NEQUI' },
        concept: PaymentConcept.TOTAL,
        status: PaymentStatus.APPROVED,
        reference: 'M123456',
        note: null,
        rejectionReason: null,
        registeredByBusiness: true,
        receivedAt: new Date('2026-01-20T10:00:00Z'),
        reservationId: 'res-1',
        reservation: {
          id: 'res-1',
          start: new Date('2026-02-01T18:00:00Z'),
          end: new Date('2026-02-01T19:00:00Z'),
          court: { name: 'Cancha Sintética 1' },
        },
        refund: null,
      },
    ]);

    const detail = await service.findOneDetail('biz-1', 'c-1');
    expect(detail.id).toBe('c-1');
    expect(detail.name).toBe('Valentina Dussán');
    expect(detail.stats.totalReservations).toBe(1);
    expect(detail.stats.confirmedReservations).toBe(1);
    expect(detail.stats.totalSpent).toBe(70000);
    expect(detail.reservations).toHaveLength(1);
    expect(detail.reservations[0].courtName).toBe('Cancha Sintética 1');
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0].method).toBe('NEQUI');
  });
});
