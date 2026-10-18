import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogsService } from './catalogs.service.js';

describe('CatalogsService', () => {
  let service: CatalogsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CatalogsService);
  });

  describe('resolveAmenityIds', () => {
    it('devuelve los ids de códigos activos', async () => {
      prisma.amenity.findMany.mockResolvedValue([
        { id: 'a1', code: 'WIFI' },
        { id: 'a2', code: 'PARQUEADERO' },
      ]);
      await expect(
        service.resolveAmenityIds(['WIFI', 'PARQUEADERO']),
      ).resolves.toEqual(['a1', 'a2']);
      expect(prisma.amenity.findMany.mock.calls[0][0].where).toEqual({
        code: { in: ['WIFI', 'PARQUEADERO'] },
        active: true,
      });
    });

    it('rechaza códigos inexistentes o inactivos indicando cuáles', async () => {
      prisma.amenity.findMany.mockResolvedValue([{ id: 'a1', code: 'WIFI' }]);
      await expect(
        service.resolveAmenityIds(['WIFI', 'PISCINA']),
      ).rejects.toThrow('Servicios no válidos: PISCINA');
    });

    it('no consulta la BD si no hay códigos', async () => {
      await expect(service.resolveAmenityIds([])).resolves.toEqual([]);
      expect(prisma.amenity.findMany).not.toHaveBeenCalled();
    });
  });

  it('rechaza un método de pago desactivado', async () => {
    prisma.paymentMethod.findUnique.mockResolvedValue({
      id: 'm1',
      code: 'NEQUI',
      active: false,
    });
    await expect(service.resolvePaymentMethod('NEQUI')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('no permite crear un código repetido', async () => {
    prisma.amenity.findUnique.mockResolvedValue({ id: 'a1', code: 'WIFI' });
    await expect(
      service.createAmenity({ code: 'WIFI', name: 'WiFi' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.amenity.create).not.toHaveBeenCalled();
  });

  it('ubica un servicio nuevo al final si no se indica el orden', async () => {
    prisma.amenity.findUnique.mockResolvedValue(null);
    prisma.amenity.findFirst.mockResolvedValue({ sortOrder: 7 });
    prisma.amenity.create.mockImplementation(({ data }) => ({
      id: 'a9',
      active: true,
      ...data,
    }));
    const result = await service.createAmenity({
      code: 'DUCHAS',
      name: 'Duchas',
    });
    expect(result.sortOrder).toBe(8);
  });

  describe('resolveCourtSurfaceId', () => {
    const surface = {
      id: 's1',
      code: 'GRAMA_SINTETICA',
      name: 'Grama sintética',
      sports: [Sport.FUTBOL, Sport.PADEL],
      active: true,
    };

    it('devuelve el id si aplica al deporte', async () => {
      prisma.courtSurface.findUnique.mockResolvedValue(surface);
      await expect(
        service.resolveCourtSurfaceId('GRAMA_SINTETICA', Sport.PADEL),
      ).resolves.toBe('s1');
    });

    it('sin deportes aplica a todos', async () => {
      prisma.courtSurface.findUnique.mockResolvedValue({
        ...surface,
        sports: [],
      });
      await expect(
        service.resolveCourtSurfaceId('CEMENTO', Sport.VOLEIBOL),
      ).resolves.toBe('s1');
    });

    it('rechaza una superficie que no aplica al deporte', async () => {
      prisma.courtSurface.findUnique.mockResolvedValue(surface);
      await expect(
        service.resolveCourtSurfaceId('GRAMA_SINTETICA', Sport.BALONCESTO),
      ).rejects.toThrow('La superficie Grama sintética no aplica a este deporte');
    });

    it('rechaza códigos inexistentes o inactivos, salvo la que ya tiene la cancha', async () => {
      prisma.courtSurface.findUnique.mockResolvedValue(null);
      await expect(
        service.resolveCourtSurfaceId('PISCINA', Sport.FUTBOL),
      ).rejects.toThrow('Superficie no válida: PISCINA');

      prisma.courtSurface.findUnique.mockResolvedValue({
        ...surface,
        active: false,
      });
      await expect(
        service.resolveCourtSurfaceId('GRAMA_SINTETICA', Sport.FUTBOL),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resolveCourtSurfaceId('GRAMA_SINTETICA', Sport.FUTBOL, 's1'),
      ).resolves.toBe('s1');
    });
  });

  it('incluye las superficies activas en los catálogos de la app', async () => {
    prisma.amenity.findMany.mockResolvedValue([]);
    prisma.paymentMethod.findMany.mockResolvedValue([]);
    prisma.courtSurface.findMany.mockResolvedValue([
      {
        id: 's1',
        code: 'MADERA',
        name: 'Madera',
        sports: [Sport.BALONCESTO],
        active: true,
        sortOrder: 1,
      },
    ]);
    const result = await service.findActive();
    expect(result.courtSurfaces).toEqual([
      {
        id: 's1',
        code: 'MADERA',
        name: 'Madera',
        sports: ['BALONCESTO'],
        active: true,
        sortOrder: 1,
      },
    ]);
    expect(prisma.courtSurface.findMany.mock.calls[0][0].where).toEqual({
      active: true,
    });
  });
});
