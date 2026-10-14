import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientsService } from './clients.service.js';

const dto = {
  fullName: 'Marcela Ruiz',
  email: 'Marcela@Norte.co',
  password: 'secreta123',
  businessName: 'Canchas del Norte',
  address: 'Calle 1',
  neighborhood: 'La Floresta',
  planId: 'plan-1',
};

const storedClient = {
  id: 'biz-1',
  name: dto.businessName,
  address: dto.address,
  neighborhood: dto.neighborhood,
  createdAt: new Date(),
  owner: {
    id: 'u1',
    displayName: dto.fullName,
    email: 'marcela@norte.co',
    phone: null,
  },
  subscription: {
    isActive: true,
    nextPayment: new Date(),
    plan: { id: 'plan-1', name: 'Básico', monthlyPrice: 89_000 },
  },
  _count: { courts: 0 },
};

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ClientsService);
  });

  it('crea usuario de negocio, negocio y suscripción en una sola operación', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan-1',
      monthlyPrice: 89_000,
    });
    prisma.business.create.mockResolvedValue(storedClient);

    const result = await service.create(dto);

    const { data } = prisma.business.create.mock.calls[0][0];
    expect(data.owner.create).toMatchObject({
      email: 'marcela@norte.co',
      role: UserRole.ADMIN_NEGOCIO,
    });
    expect(
      await bcrypt.compare('secreta123', data.owner.create.passwordHash),
    ).toBe(true);
    expect(data.subscription.create).toMatchObject({
      planId: 'plan-1',
      autoBilling: true,
    });
    expect(result.plan?.name).toBe('Básico');
  });

  it('rechaza un email ya registrado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u0' });
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1' });
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('rechaza un plan inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.plan.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toThrow(NotFoundException);
  });

  it('suspende la suscripción de un cliente', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      subscription: { id: 's1' },
    });
    prisma.business.findUniqueOrThrow.mockResolvedValue({
      ...storedClient,
      subscription: { ...storedClient.subscription, isActive: false },
    });

    const result = await service.updateSubscription('biz-1', {
      isActive: false,
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      data: { planId: undefined, isActive: false },
    });
    expect(result.subscriptionActive).toBe(false);
  });

  it('pide un plan para un cliente que no tiene suscripción', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      subscription: null,
    });
    await expect(
      service.updateSubscription('biz-1', { isActive: true }),
    ).rejects.toThrow(ConflictException);
  });
});
