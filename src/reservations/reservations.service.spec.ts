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
import { ReservationStatus, Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReservationsService } from './reservations.service.js';

const court = {
  id: 'court-1',
  businessId: 'biz-1',
  name: 'Sintética 1',
  sport: Sport.FUTBOL,
  hourlyPrice: 120_000,
  active: true,
};

const baseDto = {
  courtId: 'court-1',
  start: '2026-10-13T19:00:00-05:00',
  end: '2026-10-13T20:30:00-05:00',
  customerName: 'Valentina',
  phone: '3001234567',
};

function storedReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    businessId: 'biz-1',
    courtId: 'court-1',
    playerId: null,
    start: new Date(baseDto.start),
    end: new Date(baseDto.end),
    customerName: 'Valentina',
    customerDetail: null,
    phone: '3001234567',
    contactNote: null,
    tag: null,
    isRecurring: false,
    totalPrice: 180_000,
    status: ReservationStatus.CONFIRMED,
    createdAt: new Date(),
    updatedAt: new Date(),
    court: { name: court.name, sport: court.sport },
    payments: [{ amount: 50_000 }, { amount: 30_000 }],
    ...overrides,
  };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
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
  });

  describe('findForDay', () => {
    it('consulta el día en la zona horaria del negocio y suma lo pagado', async () => {
      prisma.reservation.findMany.mockResolvedValue([storedReservation()]);

      const [reservation] = await service.findForDay('owner-1', '2026-10-13');

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz-1',
            start: {
              gte: new Date('2026-10-13T05:00:00.000Z'),
              lt: new Date('2026-10-14T05:00:00.000Z'),
            },
          },
        }),
      );
      expect(reservation.amountPaid).toBe(80_000);
      expect(reservation.courtName).toBe('Sintética 1');
    });
  });

  describe('create', () => {
    it('rechaza un horario cuyo fin no es posterior al inicio', async () => {
      await expect(
        service.create('owner-1', { ...baseDto, end: baseDto.start }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una cancha de otro negocio', async () => {
      prisma.court.findFirst.mockResolvedValue(null);
      await expect(service.create('owner-1', baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza un cruce con otra reserva activa', async () => {
      prisma.court.findFirst.mockResolvedValue(court);
      prisma.reservation.findFirst.mockResolvedValue({ id: 'other' });

      await expect(service.create('owner-1', baseDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: {
          courtId: 'court-1',
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED],
          },
          start: { lt: new Date(baseDto.end) },
          end: { gt: new Date(baseDto.start) },
        },
        select: { id: true },
      });
    });

    it('calcula el precio con la tarifa por hora cuando no se envía', async () => {
      prisma.court.findFirst.mockResolvedValue(court);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.create.mockResolvedValue(storedReservation());

      await service.create('owner-1', baseDto);

      const { data } = prisma.reservation.create.mock.calls[0][0];
      expect(data.totalPrice).toBe(180_000);
      expect(data.businessId).toBe('biz-1');
    });
  });

  describe('updateStatus', () => {
    it('no permite modificar una reserva cancelada', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        status: ReservationStatus.CANCELLED,
      });
      await expect(
        service.updateStatus('owner-1', 'res-1', {
          status: ReservationStatus.CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('actualiza el estado de una reserva propia', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        status: ReservationStatus.CONFIRMED,
      });
      prisma.reservation.update.mockResolvedValue(
        storedReservation({ status: ReservationStatus.NO_SHOW }),
      );

      const result = await service.updateStatus('owner-1', 'res-1', {
        status: ReservationStatus.NO_SHOW,
      });
      expect(result.status).toBe(ReservationStatus.NO_SHOW);
    });
  });
});
