import { ConflictException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import type { CatalogsService } from '../catalogs/catalogs.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CashService, expectedCash } from './cash.service.js';

const openedAt = new Date('2026-10-28T13:00:00Z');

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs-1',
    businessId: 'biz-1',
    openingCash: 50_000,
    openingNote: null,
    openedAt,
    openedById: 'owner-1',
    openedByName: 'Esteban',
    closedAt: null,
    closedById: null,
    closedByName: null,
    expectedCash: null,
    countedCash: null,
    difference: null,
    closingNote: null,
    summary: null,
    expenses: [],
    ...overrides,
  };
}

const methods = [
  { code: 'EFECTIVO', name: 'Efectivo', count: 4, amount: 192_500 },
  { code: 'NEQUI', name: 'Nequi', count: 1, amount: 5_000 },
];

describe('CashService', () => {
  let prisma: PrismaMock;
  let service: CashService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Esteban' });
    prisma.$queryRaw.mockResolvedValue(methods);
    service = new CashService(
      prisma as unknown as PrismaService,
      {
        requireSalesModule: vi.fn().mockResolvedValue('biz-1'),
      } as unknown as BusinessesService,
      {
        resolvePaymentMethod: vi.fn((code: string) =>
          Promise.resolve({ id: `m-${code}`, code }),
        ),
      } as unknown as CatalogsService,
    );
  });

  it('el efectivo esperado es la base más los cobros en efectivo menos lo pagado en efectivo', () => {
    expect(expectedCash(50_000, methods)).toBe(242_500);
    expect(expectedCash(50_000, [])).toBe(50_000);
    expect(expectedCash(50_000, methods, 30_000)).toBe(212_500);
  });

  const expense = (overrides: Record<string, unknown> = {}) => ({
    id: 'ex-1',
    supplierId: 'sup-1',
    supplierName: 'Postobón',
    amount: 30_000,
    method: { code: 'EFECTIVO', name: 'Efectivo' },
    concept: 'Pedido de bebidas',
    createdAt: openedAt,
    createdByName: 'Esteban',
    voidedAt: null,
    voidReason: null,
    ...overrides,
  });

  it('caja abierta: los pagos en efectivo restan; los de otros métodos y los anulados no', async () => {
    prisma.cashSession.findFirst
      .mockResolvedValueOnce(
        session({
          expenses: [
            expense(),
            expense({
              id: 'ex-2',
              amount: 20_000,
              method: { code: 'NEQUI', name: 'Nequi' },
            }),
            expense({ id: 'ex-3', amount: 99_000, voidedAt: openedAt }),
          ],
        }),
      )
      .mockResolvedValueOnce(null);

    const result = await service.current('owner-1');

    expect(result.session).toMatchObject({
      expectedCash: 212_500,
      expensesTotal: 50_000,
      cashExpensesTotal: 30_000,
    });
    expect(result.session?.expenses).toHaveLength(3);
  });

  it('el cierre descuenta los pagos en efectivo del turno', async () => {
    prisma.cashSession.findFirst.mockResolvedValue(
      session({ expenses: [expense()] }),
    );
    prisma.cashSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashSession.findUniqueOrThrow.mockResolvedValue(session());

    await service.close('owner-1', { countedCash: 212_500 });

    expect(prisma.cashSession.updateMany.mock.calls[0][0].data).toMatchObject({
      expectedCash: 212_500,
      difference: 0,
    });
  });

  it('pagar a un proveedor exige la caja abierta y un proveedor activo', async () => {
    const dto = {
      supplierId: 'sup-1',
      amount: 30_000,
      method: 'EFECTIVO',
      concept: 'Hielo',
    };
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'sup-1',
      name: 'Hielo Polar',
      isActive: true,
    });
    prisma.cashSession.findFirst.mockResolvedValueOnce(null);
    await expect(service.addExpense('owner-1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.cashSession.findFirst.mockResolvedValueOnce({ id: 'cs-1' });
    prisma.cashExpense.create.mockImplementation(({ data }) => ({
      ...expense(),
      ...data,
      method: { code: 'EFECTIVO', name: 'Efectivo' },
    }));
    const result = await service.addExpense('owner-1', dto);
    expect(prisma.cashExpense.create.mock.calls[0][0].data).toMatchObject({
      sessionId: 'cs-1',
      supplierName: 'Hielo Polar',
      methodId: 'm-EFECTIVO',
      createdByName: 'Esteban',
    });
    expect(result.supplierName).toBe('Hielo Polar');
  });

  it('no se anula un pago de una caja ya cerrada', async () => {
    prisma.cashExpense.findFirst.mockResolvedValue({
      ...expense(),
      session: { closedAt: openedAt },
    });
    await expect(
      service.voidExpense('owner-1', 'ex-1', { reason: 'Error' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cashExpense.updateMany).not.toHaveBeenCalled();
  });

  it('caja abierta: totales hasta ahora por método', async () => {
    prisma.cashSession.findFirst
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(null);

    const result = await service.current('owner-1');

    expect(result.session).toMatchObject({
      openingCash: 50_000,
      expectedCash: 242_500,
      collected: 197_500,
      countedCash: null,
    });
    expect(result.session?.methods).toHaveLength(2);
    expect(result.lastClosed).toBeNull();
  });

  it('no abre dos cajas', async () => {
    prisma.cashSession.findFirst.mockResolvedValue({ id: 'cs-1' });
    await expect(
      service.open('owner-1', { openingCash: 10_000 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cashSession.create).not.toHaveBeenCalled();
  });

  it('abre con la base y quién la abrió', async () => {
    prisma.cashSession.findFirst.mockResolvedValue(null);
    prisma.cashSession.create.mockImplementation(({ data }) =>
      session({ ...data }),
    );

    const result = await service.open('owner-1', {
      openingCash: 80_000,
      note: 'Turno tarde',
    });

    expect(prisma.cashSession.create.mock.calls[0][0].data).toMatchObject({
      businessId: 'biz-1',
      openingCash: 80_000,
      openingNote: 'Turno tarde',
      openedByName: 'Esteban',
    });
    expect(result.expectedCash).toBe(80_000);
  });

  it('cierra con el arqueo: faltante y foto de los métodos', async () => {
    prisma.cashSession.findFirst.mockResolvedValue(session());
    prisma.cashSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashSession.findUniqueOrThrow.mockImplementation(() =>
      session({
        ...prisma.cashSession.updateMany.mock.calls[0][0].data,
      }),
    );

    const result = await service.close('owner-1', { countedCash: 240_000 });

    const { data, where } = prisma.cashSession.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 'cs-1', closedAt: null });
    expect(data).toMatchObject({
      expectedCash: 242_500,
      countedCash: 240_000,
      difference: -2_500,
      closedByName: 'Esteban',
      summary: methods,
    });
    expect(result.difference).toBe(-2_500);
    expect(result.methods).toEqual(methods);
  });

  it('sin caja abierta no se puede cerrar', async () => {
    prisma.cashSession.findFirst.mockResolvedValue(null);
    await expect(
      service.close('owner-1', { countedCash: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
