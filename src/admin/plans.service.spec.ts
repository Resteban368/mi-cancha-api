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
