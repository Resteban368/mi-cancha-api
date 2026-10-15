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

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'c-1',
    name: 'Andrés',
    phone: '+573110000001',
    documentId: '101',
    preferredSport: null,
    notes: null,
    createdAt: new Date('2026-08-01'),
    reservations: 5,
    completed: 3,
    noShow: 1,
    totalSpent: 360_000,
    balance: 40_000.004,
    lastVisit: new Date('2026-10-01T23:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
    prisma.court.findFirst.mockResolvedValue({ currency: 'COP' });
  });

  it('arma la página y el resumen con lo que calcula la base de datos', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        row(),
        row({
          id: 'c-2',
          name: 'Camila',
          reservations: 0,
          completed: 0,
          noShow: 0,
          totalSpent: 0,
          balance: 0,
          lastVisit: null,
          preferredSport: 'PADEL',
        }),
      ])
      .mockResolvedValueOnce([
        {
          totalCustomers: 3,
          newThisMonth: 2,
          newLastMonth: 1,
          loyalCustomers: 1,
          totalReservations: 6,
          pendingBalance: 40_000,
          filtered: 2,
        },
      ])
      .mockResolvedValueOnce([{ customerId: 'c-1', courtName: 'Sintética 1' }])
      .mockResolvedValueOnce([
        { customerId: 'c-1', sport: Sport.PADEL, count: 1 },
        { customerId: 'c-1', sport: Sport.FUTBOL, count: 4 },
      ]);

    const result = await service.findPaginated(
      'biz-1',
      { page: 2, pageSize: 2 },
      now,
    );

    expect(result).toMatchObject({ total: 2, page: 2, pageSize: 2 });
    expect(result.overview).toEqual({
      totalCustomers: 3,
      newThisMonth: 2,
      newVsLastMonthPct: 100,
      loyalCustomers: 1,
      loyalPct: 33,
      totalReservations: 6,
      pendingBalance: 40_000,
      currency: 'COP',
    });
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
    expect(result.items[1].metrics).toMatchObject({
      level: 'NEW',
      attendancePct: null,
      lastVisit: null,
      favoriteSport: Sport.PADEL, // el elegido por el negocio
    });
  });

  it('no consulta canchas ni deportes si la página viene vacía', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          totalCustomers: 0,
          newThisMonth: 0,
          newLastMonth: 0,
          loyalCustomers: 0,
          totalReservations: 0,
          pendingBalance: 0,
          filtered: 0,
        },
      ]);
    const result = await service.findPaginated(
      'biz-1',
      { page: 1, pageSize: 20 },
      now,
    );
    expect(result.items).toEqual([]);
    expect(result.overview.newVsLastMonthPct).toBeNull();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('envía a SQL búsqueda, segmento, orden y página', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        totalCustomers: 0,
        newThisMonth: 0,
        newLastMonth: 0,
        loyalCustomers: 0,
        totalReservations: 0,
        pendingBalance: 0,
        filtered: 0,
      },
    ]);
    await service.findPaginated(
      'biz-1',
      {
        page: 3,
        pageSize: 10,
        search: '1.02_%',
        segment: 'LOYAL',
        sort: 'TOP_SPENDERS',
      },
      now,
    );
    const page = prisma.$queryRaw.mock.calls[0][0];
    const sql = page.sql.replace(/\s+/g, ' ');
    expect(sql).toContain('"name" ILIKE ?');
    expect(sql).toContain('"phone" LIKE ?');
    expect(sql).toContain('"documentId" LIKE ?');
    expect(sql).toContain('"reservations" >= ?');
    expect(sql).toContain(
      'ORDER BY m."totalSpent" DESC, m."name" COLLATE "es-x-icu" ASC',
    );
    // Los comodines que escribe el usuario se escapan.
    expect(page.values).toContain('%1.02\\_\\%%');
    expect(page.values).toContain('%102%');
    expect(page.values).toContain(5);
    expect(page.values.slice(-2)).toEqual([10, 20]);
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
