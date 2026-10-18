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
import { CatalogsService } from '../catalogs/catalogs.service.js';
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
    surfaceId: null,
    surface: null,
    lengthMeters: null,
    widthMeters: null,
    playersPerSide: null,
    ...overrides,
  };
}

describe('CourtsService', () => {
  let service: CourtsService;
  let prisma: PrismaMock;
  let resolveCourtSurfaceId: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    resolveCourtSurfaceId = vi.fn().mockResolvedValue('s-1');
    const moduleRef = await Test.createTestingModule({
      providers: [
        CourtsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BusinessesService,
          useValue: { requireBusinessId: vi.fn().mockResolvedValue('biz-1') },
        },
        { provide: CatalogsService, useValue: { resolveCourtSurfaceId } },
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

  describe('superficie y medidas', () => {
    const grass = {
      surfaceId: 's-1',
      surface: { code: 'GRAMA_SINTETICA', name: 'Grama sintética' },
      lengthMeters: { toString: () => '20' },
      widthMeters: { toString: () => '10.5' },
      playersPerSide: 2,
    };

    it('crea la cancha con superficie, medidas y formato', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3));
      prisma.court.count.mockResolvedValue(0);
      prisma.court.create.mockResolvedValue(storedCourt(grass));

      const result = await service.create('owner-1', {
        ...dto,
        surface: 'GRAMA_SINTETICA',
        lengthMeters: 20,
        widthMeters: 10.5,
        playersPerSide: 2,
      });

      expect(resolveCourtSurfaceId).toHaveBeenCalledWith(
        'GRAMA_SINTETICA',
        Sport.PADEL,
      );
      expect(prisma.court.create.mock.calls[0][0].data).toMatchObject({
        surfaceId: 's-1',
        lengthMeters: 20,
        widthMeters: 10.5,
        playersPerSide: 2,
      });
      expect(result).toMatchObject({
        surface: { code: 'GRAMA_SINTETICA', name: 'Grama sintética' },
        lengthMeters: 20,
        widthMeters: 10.5,
        playersPerSide: 2,
      });
    });

    it('sin los datos nuevos los guarda vacíos', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription(3));
      prisma.court.count.mockResolvedValue(0);
      prisma.court.create.mockResolvedValue(storedCourt());

      const result = await service.create('owner-1', dto);

      expect(resolveCourtSurfaceId).not.toHaveBeenCalled();
      expect(prisma.court.create.mock.calls[0][0].data).toMatchObject({
        surfaceId: null,
        lengthMeters: null,
        widthMeters: null,
        playersPerSide: null,
      });
      expect(result.surface).toBeNull();
      expect(result.lengthMeters).toBeNull();
    });

    it('exige las dos medidas juntas', async () => {
      await expect(
        service.create('owner-1', { ...dto, lengthMeters: 20 }),
      ).rejects.toThrow(BadRequestException);

      prisma.court.findFirst.mockResolvedValue(storedCourt(grass));
      await expect(
        service.update('owner-1', 'c-1', { widthMeters: null }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.court.update).not.toHaveBeenCalled();
    });

    it('al editar, null quita la superficie y omitirla la conserva', async () => {
      prisma.court.findFirst.mockResolvedValue(storedCourt(grass));
      prisma.court.update.mockResolvedValue(storedCourt());

      await service.update('owner-1', 'c-1', { surface: null });
      expect(prisma.court.update.mock.calls[0][0].data.surfaceId).toBeNull();

      await service.update('owner-1', 'c-1', { name: 'Otra' });
      expect(prisma.court.update.mock.calls[1][0].data).not.toHaveProperty(
        'surfaceId',
      );
      expect(resolveCourtSurfaceId).not.toHaveBeenCalled();
    });

    it('al cambiar el deporte revalida la superficie actual', async () => {
      prisma.court.findFirst.mockResolvedValue(storedCourt(grass));
      resolveCourtSurfaceId.mockRejectedValue(
        new BadRequestException('no aplica'),
      );

      await expect(
        service.update('owner-1', 'c-1', { sport: Sport.BALONCESTO }),
      ).rejects.toThrow(BadRequestException);
      expect(resolveCourtSurfaceId).toHaveBeenCalledWith(
        'GRAMA_SINTETICA',
        Sport.BALONCESTO,
        's-1',
      );
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
