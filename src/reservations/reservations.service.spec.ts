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
          useValue: { getOrThrow: vi.fn().mockReturnValue('-05:00') },
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
      phone: '3001234567',
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
});
