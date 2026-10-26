import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessesService } from './businesses.service.js';

const dto = {
  name: 'El Golazo',
  address: 'Calle 15 # 8-32',
  neighborhood: 'Centro',
};

/** Simula lo que devuelve Prisma con `include: { amenities }`. */
function storedBusiness(data: Record<string, unknown>) {
  return {
    id: 'biz-1',
    ...data,
    amenities: [{ code: 'WIFI' }],
    profileImages: [],
  };
}

describe('BusinessesService', () => {
  let service: BusinessesService;
  let prisma: PrismaMock;
  const catalogs = {
    resolveAmenityIds: vi.fn((codes: string[]) =>
      Promise.resolve(codes.map((code) => `id-${code}`)),
    ),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CatalogsService, useValue: catalogs },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            PUBLIC_API_URL: 'https://api.test/',
          }),
        },
      ],
    }).compile();
    service = moduleRef.get(BusinessesService);
  });

  it('lanza 404 si el administrador aún no tiene negocio', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(service.findMine('owner-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.requireBusinessId('owner-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('arma las URLs públicas de las fotos; la primera es la portada', async () => {
    prisma.business.findUnique.mockResolvedValue({
      ...storedBusiness(dto),
      profileImages: [{ id: 'img-1' }, { id: 'img-2' }],
    });

    const result = await service.findMine('owner-1');

    expect(result.imageUrl).toBe(
      'https://api.test/api/v1/images/business-profile/img-1',
    );
    expect(result.photos).toEqual([
      {
        id: 'img-1',
        url: 'https://api.test/api/v1/images/business-profile/img-1',
      },
      {
        id: 'img-2',
        url: 'https://api.test/api/v1/images/business-profile/img-2',
      },
    ]);
  });

  it('al crear el negocio exige ciudad; al actualizar la conserva si no se envía', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(service.save('owner-1', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.business.create).not.toHaveBeenCalled();

    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.business.update.mockImplementation(({ data }) =>
      storedBusiness(data),
    );
    await service.save('owner-1', dto);
    expect(prisma.business.update.mock.calls[0][0].data).not.toHaveProperty(
      'cityId',
    );
  });

  it('rechaza una ciudad que no existe en el catálogo', async () => {
    prisma.city.count.mockResolvedValue(0);
    await expect(
      service.save('owner-1', { ...dto, cityId: 'no-existe' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('al crear el negocio conecta sus servicios y le da 15 días de prueba', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.create.mockImplementation(({ data }) =>
      storedBusiness(data),
    );
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-trial' });
    prisma.city.count.mockResolvedValue(1);

    const result = await service.save('owner-1', {
      ...dto,
      cityId: 'city-1',
      amenities: ['WIFI'],
    });

    expect(prisma.business.create.mock.calls[0][0].data).toMatchObject({
      ...dto,
      cityId: 'city-1',
      ownerId: 'owner-1',
      description: null,
      amenities: { connect: [{ id: 'id-WIFI' }] },
    });
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        planId: 'plan-trial',
        trialEndsAt: expect.any(Date),
      }),
    });
    const { trialEndsAt } = prisma.subscription.create.mock.calls[0][0].data;
    const days = (trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(15);
    expect(result.amenities).toEqual(['WIFI']);
    expect(result.imageUrl).toBeNull();
  });

  it('al actualizar reemplaza los servicios y no toca la suscripción', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.business.update.mockImplementation(({ data }) =>
      storedBusiness(data),
    );

    await service.save('owner-1', { ...dto, name: 'Nuevo nombre' });

    expect(prisma.business.update.mock.calls[0][0].data.amenities).toEqual({
      set: [],
    });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('guarda y devuelve el punto de llegada', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.business.update.mockImplementation(({ data }) =>
      storedBusiness(data),
    );

    const result = await service.save('owner-1', {
      ...dto,
      latitude: 4.6097,
      longitude: -74.0817,
    });

    expect(prisma.business.update.mock.calls[0][0].data).toMatchObject({
      latitude: 4.6097,
      longitude: -74.0817,
    });
    expect(result).toMatchObject({ latitude: 4.6097, longitude: -74.0817 });
  });

  it('sin coordenadas borra la ubicación (es un PUT)', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    prisma.business.update.mockImplementation(({ data }) =>
      storedBusiness(data),
    );

    const result = await service.save('owner-1', dto);

    expect(prisma.business.update.mock.calls[0][0].data).toMatchObject({
      latitude: null,
      longitude: null,
    });
    expect(result.latitude).toBeNull();
  });

  it('rechaza latitude sin longitude', async () => {
    await expect(
      service.save('owner-1', { ...dto, latitude: 4.6 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});
