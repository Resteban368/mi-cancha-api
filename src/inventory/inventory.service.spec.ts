import { ConflictException } from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from './inventory.service.js';
import { restoreStockForSales, takeStockForSale } from './stock.js';

const actor = { id: 'owner-1', name: 'Esteban' };

describe('stock', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('descuenta solo los productos con control de stock', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p-agua' }]);
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue({ stock: 18 });

    await takeStockForSale(prisma as never, {
      businessId: 'biz-1',
      saleId: 'sale-1',
      lines: [
        { productId: 'p-agua', productName: 'Agua', quantity: 6 },
        { productId: 'p-petos', productName: 'Petos', quantity: 1 },
      ],
      actor,
    });

    expect(prisma.product.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'p-agua', stock: { gte: 6 } },
      data: { stock: { decrement: 6 } },
    });
    expect(prisma.stockMovement.create.mock.calls[0][0].data).toMatchObject({
      type: StockMovementType.VENTA,
      quantity: -6,
      stockAfter: 18,
      saleId: 'sale-1',
    });
  });

  it('no deja vender más de lo que hay', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p-agua' }]);
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    prisma.product.findUniqueOrThrow.mockResolvedValue({ stock: 2 });

    await expect(
      takeStockForSale(prisma as never, {
        businessId: 'biz-1',
        saleId: 'sale-1',
        lines: [{ productId: 'p-agua', productName: 'Agua', quantity: 6 }],
        actor,
      }),
    ).rejects.toThrow('No hay suficiente stock de Agua: quedan 2');
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('al anular devuelve exactamente lo que se descontó', async () => {
    prisma.stockMovement.findMany.mockResolvedValue([
      { productId: 'p-agua', quantity: -6, saleId: 'sale-1' },
    ]);
    prisma.product.update.mockResolvedValue({ stock: 24 });

    await restoreStockForSales(prisma as never, {
      businessId: 'biz-1',
      saleIds: ['sale-1'],
      actor,
    });

    expect(prisma.product.update.mock.calls[0][0].data).toEqual({
      stock: { increment: 6 },
    });
    expect(prisma.stockMovement.create.mock.calls[0][0].data).toMatchObject({
      type: StockMovementType.ANULACION,
      quantity: 6,
      stockAfter: 24,
    });
  });
});

describe('InventoryService', () => {
  let prisma: PrismaMock;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Esteban' });
    prisma.product.findFirst.mockResolvedValue({ id: 'p-agua' });
    prisma.stockMovement.create.mockImplementation(({ data }) => ({
      id: 'mv-1',
      createdAt: new Date(),
      unitCost: null,
      supplierId: null,
      saleId: null,
      note: null,
      ...data,
      product: { name: 'Agua' },
      supplier: null,
    }));
    service = new InventoryService(
      prisma as unknown as PrismaService,
      {
        requireInventoryModule: vi.fn().mockResolvedValue('biz-1'),
      } as unknown as BusinessesService,
    );
  });

  it('resumen: stock bajo y agotados', async () => {
    const product = (id: string, stock: number, minStock: number | null) => ({
      id,
      name: id,
      category: 'AGUA',
      price: 2_500,
      trackStock: true,
      stock,
      minStock,
    });
    prisma.product.findMany.mockResolvedValue([
      product('a', 30, 10),
      product('b', 5, 10),
      product('c', 0, null),
      { ...product('d', 0, null), trackStock: false },
    ]);

    const result = await service.overview('owner-1');

    expect(result).toMatchObject({ tracked: 3, low: 1, out: 1 });
    expect(result.items.find((i) => i.id === 'b')?.lowStock).toBe(true);
    expect(result.items.find((i) => i.id === 'd')?.lowStock).toBe(false);
  });

  it('una entrada suma al stock y activa su control', async () => {
    prisma.product.update.mockResolvedValue({ stock: 30 });

    const result = await service.addEntry('owner-1', {
      productId: 'p-agua',
      quantity: 24,
      unitCost: 1_200,
    });

    expect(prisma.product.update.mock.calls[0][0].data).toEqual({
      stock: { increment: 24 },
      trackStock: true,
    });
    expect(result).toMatchObject({
      type: StockMovementType.ENTRADA,
      quantity: 24,
      stockAfter: 30,
      productName: 'Agua',
    });
  });

  it('el ajuste deja el stock contado y guarda la diferencia', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({ stock: 20 });

    const result = await service.adjust('owner-1', {
      productId: 'p-agua',
      stock: 17,
      reason: 'Conteo físico',
    });

    expect(prisma.product.update.mock.calls[0][0].data).toEqual({
      stock: 17,
      trackStock: true,
    });
    expect(result).toMatchObject({ quantity: -3, stockAfter: 17 });
  });

  it('un ajuste sin cambio no se registra', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({ stock: 20 });
    await expect(
      service.adjust('owner-1', {
        productId: 'p-agua',
        stock: 20,
        reason: 'Conteo',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
