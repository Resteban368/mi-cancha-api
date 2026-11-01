import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlansService } from './plans.service.js';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PlansService);
  });

  it('no permite dos planes con el mismo nombre', async () => {
    prisma.plan.findUnique.mockResolvedValue({ id: 'p1', name: 'Pro' });
    await expect(
      service.create({
        name: 'Pro',
        monthlyPrice: 1,
        courtLimit: 1,
        benefits: [],
      }),
    ).rejects.toThrow(ConflictException);
  });

  describe('tabla de precios por canchas', () => {
    const mainPlan = {
      id: 'p1',
      name: 'Mi Cancha',
      monthlyPrice: 79_000,
      courtLimit: 20,
      pricedByCourts: true,
      courtPrices: [79_000, 98_000],
      benefits: [],
    };

    beforeEach(() => {
      prisma.plan.update.mockResolvedValue({
        ...mainPlan,
        _count: { subscriptions: 0 },
      });
    });

    it('guarda la tabla y sincroniza el precio «desde»', async () => {
      prisma.plan.findUnique.mockResolvedValue(mainPlan);

      await service.update('p1', { courtPrices: [85_000, 100_000] });

      expect(prisma.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            courtPrices: [85_000, 100_000],
            monthlyPrice: 85_000,
            courtLimit: 20,
          }),
        }),
      );
    });

    it('rechaza que más canchas cuesten menos', async () => {
      prisma.plan.findUnique.mockResolvedValue(mainPlan);

      await expect(
        service.update('p1', { courtPrices: [100_000, 90_000] }),
      ).rejects.toThrow('El precio de 2 canchas no puede ser menor que el de 1');
      expect(prisma.plan.update).not.toHaveBeenCalled();
    });

    it('no acepta tabla en un plan de precio fijo', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        ...mainPlan,
        name: 'Prueba',
        pricedByCourts: false,
      });

      await expect(
        service.update('p1', { courtPrices: [1, 2] }),
      ).rejects.toThrow(ConflictException);
    });

    it('ignora precio y límite sueltos en el plan por canchas', async () => {
      prisma.plan.findUnique.mockResolvedValue(mainPlan);

      await service.update('p1', { monthlyPrice: 1, courtLimit: 500 });

      expect(prisma.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyPrice: 79_000,
            courtLimit: 20,
          }),
        }),
      );
    });
  });

  it('no elimina un plan con clientes', async () => {
    prisma.plan.findUnique.mockResolvedValue({
      id: 'p1',
      _count: { subscriptions: 3 },
    });
    await expect(service.remove('p1')).rejects.toThrow(
      'No se puede eliminar: 3 cliente(s) usan este plan',
    );
    expect(prisma.plan.delete).not.toHaveBeenCalled();
  });

  it('elimina un plan sin clientes', async () => {
    prisma.plan.findUnique.mockResolvedValue({
      id: 'p1',
      _count: { subscriptions: 0 },
    });
    await service.remove('p1');
    expect(prisma.plan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});
