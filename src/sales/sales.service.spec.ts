import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import {
  PaymentConcept,
  PaymentStatus,
  ReservationStatus,
  SaleStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalesService } from './sales.service.js';

const cash = {
  id: 'm-cash',
  code: 'EFECTIVO',
  name: 'Efectivo',
  requiresReference: false,
};
const water = { id: 'p-water', name: 'Agua', price: 2_500, isActive: true };
const drink = {
  id: 'p-drink',
  name: 'Gatorade',
  price: 5_000,
  isActive: true,
};

function storedSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    businessId: 'biz-1',
    reservationId: null,
    customerName: null,
    total: 0,
    note: null,
    status: SaleStatus.ACTIVE,
    voidReason: null,
    voidedAt: null,
    createdById: 'owner-1',
    createdAt: new Date(),
    items: [],
    payment: null,
    ...overrides,
  };
}

describe('SalesService', () => {
  let service: SalesService;
  let prisma: PrismaMock;
  const catalogs = { resolvePaymentMethod: vi.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    catalogs.resolvePaymentMethod.mockReset().mockResolvedValue(cash);
    prisma.product.findMany.mockResolvedValue([water, drink]);
    prisma.sale.create.mockResolvedValue({ id: 'sale-1' });
    prisma.sale.findUniqueOrThrow.mockImplementation(() => storedSale());
    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BusinessesService,
          useValue: { requireBusinessId: vi.fn().mockResolvedValue('biz-1') },
        },
        { provide: CatalogsService, useValue: catalogs },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '-05:00' },
        },
      ],
    }).compile();
    service = moduleRef.get(SalesService);
  });

  describe('createSale', () => {
    it('carga el consumo a la reserva y suma al saldo, sin pago propio', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        status: ReservationStatus.CONFIRMED,
        customerName: 'Juan',
      });

      await service.createSale(
        'owner-1',
        {
          reservationId: 'res-1',
          items: [
            { productId: drink.id, quantity: 12 },
            { productId: water.id, quantity: 6 },
          ],
        },
        'owner-1',
      );

      const { data } = prisma.sale.create.mock.calls[0][0];
      expect(data.total).toBe(75_000);
      expect(data.customerName).toBe('Juan');
      expect(data.items.create).toHaveLength(2);
      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { consumptionsTotal: { increment: 75_000 } },
      });
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('junta el mismo producto en una sola línea', async () => {
      prisma.product.findMany.mockResolvedValue([water]);

      await service.createSale(
        'owner-1',
        {
          items: [
            { productId: water.id, quantity: 2 },
            { productId: water.id, quantity: 3 },
          ],
          payment: { method: 'EFECTIVO' },
        },
        'owner-1',
      );

      const { data } = prisma.sale.create.mock.calls[0][0];
      expect(data.items.create).toEqual([
        expect.objectContaining({ quantity: 5, subtotal: 12_500 }),
      ]);
    });

    it('una venta suelta se paga en el momento con concepto VENTA', async () => {
      prisma.product.findMany.mockResolvedValue([water]);

      await service.createSale(
        'owner-1',
        {
          items: [{ productId: water.id, quantity: 2 }],
          payment: { method: 'EFECTIVO', reference: 'ignorada' },
        },
        'owner-1',
      );

      const { data } = prisma.payment.create.mock.calls[0][0];
      expect(data).toMatchObject({
        saleId: 'sale-1',
        amount: 5_000,
        concept: PaymentConcept.VENTA,
        status: PaymentStatus.APPROVED,
        customerName: 'Venta de mostrador',
        reference: null,
      });
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('pide el método de pago en una venta suelta', async () => {
      await expect(
        service.createSale(
          'owner-1',
          { items: [{ productId: water.id, quantity: 1 }] },
          'owner-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza productos desactivados o de otro negocio', async () => {
      prisma.product.findMany.mockResolvedValue([water]);

      await expect(
        service.createSale(
          'owner-1',
          {
            items: [
              { productId: water.id, quantity: 1 },
              { productId: 'otro', quantity: 1 },
            ],
            payment: { method: 'EFECTIVO' },
          },
          'owner-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('no carga consumos a una reserva cancelada', async () => {
      prisma.product.findMany.mockResolvedValue([water]);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        status: ReservationStatus.CANCELLED,
        customerName: 'Juan',
      });

      await expect(
        service.createSale(
          'owner-1',
          {
            reservationId: 'res-1',
            items: [{ productId: water.id, quantity: 1 }],
          },
          'owner-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });
  });

  describe('voidSale', () => {
    it('descuenta el consumo del saldo de la reserva', async () => {
      prisma.sale.updateMany.mockResolvedValue({ count: 1 });
      prisma.sale.findFirst.mockResolvedValue(
        storedSale({
          reservationId: 'res-1',
          total: 75_000,
          status: SaleStatus.VOIDED,
        }),
      );

      const result = await service.voidSale('owner-1', 'sale-1', {
        reason: 'Error',
      });

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { consumptionsTotal: { decrement: 75_000 } },
      });
      expect(result.status).toBe(SaleStatus.VOIDED);
    });

    it('devuelve el pago de una venta suelta', async () => {
      prisma.sale.updateMany.mockResolvedValue({ count: 1 });
      prisma.sale.findFirst.mockResolvedValue(storedSale({ total: 5_000 }));

      await service.voidSale('owner-1', 'sale-1', { reason: 'Error' });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { saleId: 'sale-1', status: PaymentStatus.APPROVED },
        data: { status: PaymentStatus.REFUNDED },
      });
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('no anula dos veces', async () => {
      prisma.sale.updateMany.mockResolvedValue({ count: 0 });
      prisma.sale.findFirst.mockResolvedValue(
        storedSale({ status: SaleStatus.VOIDED }),
      );

      await expect(
        service.voidSale('owner-1', 'sale-1', { reason: 'Error' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('404 si la venta no es del negocio', async () => {
      prisma.sale.updateMany.mockResolvedValue({ count: 0 });
      prisma.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.voidSale('owner-1', 'sale-x', { reason: 'Error' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('productos', () => {
    it('no repite nombres sin importar mayúsculas', async () => {
      prisma.product.count.mockResolvedValue(3);
      prisma.product.findFirst.mockResolvedValue({ id: 'p-water' });

      await expect(
        service.createProduct('owner-1', { name: 'agua', price: 2_000 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
