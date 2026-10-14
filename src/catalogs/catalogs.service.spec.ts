import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
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
});
