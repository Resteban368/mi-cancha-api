import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CourtPhotoSlot, DayOfWeek, Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAYS } from './court-time.js';
import { CourtsService } from './courts.service.js';
import type { CreateCourtDto } from './dto/court.dto.js';

const schedules = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  openTime: '06:00',
  closeTime: '23:00',
}));

const dto: CreateCourtDto = {
  name: 'Pádel 3',
  sport: Sport.PADEL,
  isCovered: true,
  basePricePerHour: 89_900,
  schedules,
  rates: [
    {
      name: 'Nocturna',
      pricePerHour: 99_900.5,
      days: [DayOfWeek.MONDAY],
      startTime: '18:00',
      endTime: '23:00',
    },
  ],
};

const subscription = (courtLimit: number, isActive = true) => ({
  isActive,
  plan: { name: 'Básico', courtLimit },
});

/** Lo que devuelve Prisma con courtInclude (Decimal llega como objeto). */
function storedCourt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    name: dto.name,
    sport: dto.sport,
    isCovered: true,
    isActive: true,
    currency: 'COP',
    basePricePerHour: { toString: () => '89900' },
    slotDuration: 60,
    schedules: [...schedules].reverse(),
    rates: [{ ...dto.rates![0], pricePerHour: { toString: () => '99900.5' } }],
    photos: [{ id: 'p-1', slot: CourtPhotoSlot.MAIN }],
    ...overrides,
  };
}

describe('CourtsService', () => {
  let service: CourtsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CourtsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BusinessesService,
          useValue: { requireBusinessId: vi.fn().mockResolvedValue('biz-1') },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ PUBLIC_API_URL: 'https://api.test' }),
        },
      ],
    }).compile();
    service = moduleRef.get(CourtsService);
  });

  describe('create', () => {
    it('crea la cancha con horarios, tarifas y valores por defecto', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3));
      prisma.court.count.mockResolvedValue(2);
      prisma.court.create.mockResolvedValue(storedCourt());

      const result = await service.create('owner-1', dto);

      const { data } = prisma.court.create.mock.calls[0][0];
      expect(data).toMatchObject({
        businessId: 'biz-1',
        isActive: true,
        currency: 'COP',
        slotDuration: 60,
        basePricePerHour: 89_900,
      });
      expect(data.schedules.create).toHaveLength(7);
      expect(data.rates.create[0]).toMatchObject({ sortOrder: 0 });

      expect(result.basePricePerHour).toBe(89_900);
      expect(result.rates[0].pricePerHour).toBe(99_900.5);
      expect(result.schedules.map((s) => s.dayOfWeek)).toEqual(DAYS);
      expect(result.photos).toEqual([
        { slot: 'MAIN', url: 'https://api.test/api/v1/images/courts/p-1' },
      ]);
      expect(result.missingPhotos).toEqual(['SURFACE', 'LIGHTING']);
      expect(result.isComplete).toBe(false);
      expect(result.isBookable).toBe(false);
    });

    it('rechaza horarios incompletos y tarifas que se cruzan', async () => {
      await expect(
        service.create('owner-1', {
          ...dto,
          schedules: schedules.slice(1),
          rates: [dto.rates![0], { ...dto.rates![0], name: 'Otra' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.court.create).not.toHaveBeenCalled();
    });

    it('rechaza una cancha activa por encima del límite con PLAN_LIMIT_REACHED', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3));
      prisma.court.count.mockResolvedValue(3);

      const error = await service.create('owner-1', dto).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    });

    it('con el límite alcanzado permite una sola cancha inactiva', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3));
      prisma.court.create.mockResolvedValue(storedCourt({ isActive: false }));

      prisma.court.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
      await expect(
        service.create('owner-1', { ...dto, isActive: false }),
      ).resolves.toMatchObject({ isActive: false });

      prisma.court.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      await expect(
        service.create('owner-1', { ...dto, isActive: false }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('exige un plan activo para crear canchas activas', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3, false));
      const error = await service.create('owner-1', dto).catch((e) => e);
      expect(error.getResponse()).toMatchObject({ code: 'PLAN_INACTIVE' });
    });
  });

  describe('update', () => {
    it('valida el cupo al reactivar una cancha', async () => {
      prisma.court.findFirst.mockResolvedValue(
        storedCourt({ isActive: false }),
      );
      prisma.subscription.findUnique.mockResolvedValue(subscription(1));
      prisma.court.count.mockResolvedValue(1);
      await expect(
        service.update('owner-1', 'c-1', { isActive: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reemplaza horarios y tarifas solo si se envían', async () => {
      prisma.court.findFirst.mockResolvedValue(storedCourt());
      prisma.court.update.mockResolvedValue(storedCourt());

      await service.update('owner-1', 'c-1', { name: 'Nuevo', rates: [] });

      const { data } = prisma.court.update.mock.calls[0][0];
      expect(data.name).toBe('Nuevo');
      expect(data.rates).toEqual({ deleteMany: {}, create: [] });
      expect(data.schedules).toBeUndefined();
    });
  });

  it('lanza 404 al desactivar una cancha ajena', async () => {
    prisma.court.findFirst.mockResolvedValue(null);
    await expect(service.deactivate('owner-1', 'c-x')).rejects.toThrow(
      NotFoundException,
    );
  });
});
