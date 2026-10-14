import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CourtsService } from './courts.service.js';

const dto = { name: 'Pádel 3', sport: Sport.PADEL, hourlyPrice: 90_000 };
const subscription = (courtLimit: number, isActive = true) => ({
  isActive,
  plan: { name: 'Básico', courtLimit },
});

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
      ],
    }).compile();
    service = moduleRef.get(CourtsService);
  });

  it('crea la cancha si hay cupo en el plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue(subscription(3));
    prisma.court.count.mockResolvedValue(2);
    prisma.court.create.mockResolvedValue({ id: 'c-1', active: true, ...dto });

    const result = await service.create('owner-1', dto);

    expect(prisma.court.create).toHaveBeenCalledWith({
      data: { ...dto, businessId: 'biz-1' },
    });
    expect(result.name).toBe('Pádel 3');
  });

  it('rechaza crear canchas por encima del límite del plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue(subscription(3));
    prisma.court.count.mockResolvedValue(3);
    await expect(service.create('owner-1', dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza crear canchas sin un plan activo', async () => {
    prisma.subscription.findUnique.mockResolvedValue(subscription(3, false));
    await expect(service.create('owner-1', dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('valida el cupo al reactivar una cancha', async () => {
    prisma.court.findFirst.mockResolvedValue({ id: 'c-1', active: false });
    prisma.subscription.findUnique.mockResolvedValue(subscription(1));
    prisma.court.count.mockResolvedValue(1);
    await expect(
      service.update('owner-1', 'c-1', { active: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanza 404 al desactivar una cancha ajena', async () => {
    prisma.court.findFirst.mockResolvedValue(null);
    await expect(service.deactivate('owner-1', 'c-x')).rejects.toThrow(
      NotFoundException,
    );
  });
});
