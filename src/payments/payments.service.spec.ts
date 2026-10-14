import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { PaymentConcept, PaymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

const cash = {
  id: 'm-cash',
  code: 'EFECTIVO',
  name: 'Efectivo',
  requiresReference: false,
};
const nequi = {
  id: 'm-nequi',
  code: 'NEQUI',
  name: 'Nequi',
  requiresReference: true,
};

function storedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    businessId: 'biz-1',
    reservationId: null,
    customerName: 'Camilo',
    amount: 60_000,
    methodId: nequi.id,
    method: { code: nequi.code },
    concept: PaymentConcept.SALDO,
    status: PaymentStatus.PENDING,
    reference: 'M123',
    note: null,
    rejectionReason: null,
    registeredByBusiness: false,
    receivedAt: new Date(),
    updatedAt: new Date(),
    reservation: null,
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaMock;
  const catalogs = { resolvePaymentMethod: vi.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    catalogs.resolvePaymentMethod.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BusinessesService,
          useValue: { requireBusinessId: vi.fn().mockResolvedValue('biz-1') },
        },
        { provide: CatalogsService, useValue: catalogs },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  describe('create', () => {
    it('registra el pago aprobado y descarta la referencia en efectivo', async () => {
      catalogs.resolvePaymentMethod.mockResolvedValue(cash);
      prisma.payment.create.mockImplementation(({ data }) =>
        storedPayment({ ...data, method: { code: cash.code } }),
      );

      const result = await service.create('owner-1', {
        customerName: 'Camilo',
        amount: 100_000,
        method: 'EFECTIVO',
        concept: PaymentConcept.TOTAL,
        reference: 'ignorada',
      });

      const { data } = prisma.payment.create.mock.calls[0][0];
      expect(data.status).toBe(PaymentStatus.APPROVED);
      expect(data.registeredByBusiness).toBe(true);
      expect(data.reference).toBeNull();
      expect(data.methodId).toBe(cash.id);
      expect(result.method).toBe('EFECTIVO');
    });

    it('exige referencia cuando el método la requiere', async () => {
      catalogs.resolvePaymentMethod.mockResolvedValue(nequi);
      await expect(
        service.create('owner-1', {
          customerName: 'Camilo',
          amount: 100_000,
          method: 'NEQUI',
          concept: PaymentConcept.TOTAL,
          reference: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rechaza una reserva que no pertenece al negocio', async () => {
      prisma.reservation.findFirst.mockResolvedValue(null);
      await expect(
        service.create('owner-1', {
          customerName: 'Camilo',
          amount: 100_000,
          method: 'NEQUI',
          concept: PaymentConcept.TOTAL,
          reference: 'M1',
          reservationId: 'res-ajena',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('approve / reject', () => {
    it('aprueba solo pagos pendientes del negocio', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(
        storedPayment({ status: PaymentStatus.APPROVED }),
      );

      const result = await service.approve('owner-1', 'pay-1');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'pay-1',
          businessId: 'biz-1',
          status: PaymentStatus.PENDING,
        },
        data: { status: PaymentStatus.APPROVED },
      });
      expect(result.status).toBe(PaymentStatus.APPROVED);
    });

    it('lanza 409 si el pago ya estaba validado', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findFirst.mockResolvedValue(
        storedPayment({ status: PaymentStatus.REJECTED }),
      );
      await expect(service.approve('owner-1', 'pay-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza 404 si el pago no existe', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.reject('owner-1', 'pay-x', { reason: 'No coincide' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('guarda el motivo al rechazar', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(
        storedPayment({
          status: PaymentStatus.REJECTED,
          rejectionReason: 'No coincide',
        }),
      );

      const result = await service.reject('owner-1', 'pay-1', {
        reason: 'No coincide',
      });

      expect(prisma.payment.updateMany.mock.calls[0][0].data).toEqual({
        status: PaymentStatus.REJECTED,
        rejectionReason: 'No coincide',
      });
      expect(result.rejectionReason).toBe('No coincide');
    });
  });
});
