import { ConflictException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
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
        requireBusinessId: vi.fn().mockResolvedValue('biz-1'),
      } as unknown as BusinessesService,
    );
  });

  it('el efectivo esperado es la base más los pagos en efectivo', () => {
    expect(expectedCash(50_000, methods)).toBe(242_500);
    expect(expectedCash(50_000, [])).toBe(50_000);
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
