import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: new ConfigService({ PUBLIC_API_URL: 'https://api.test' }),
        },
      ],
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

  describe('findOne', () => {
    const now = new Date('2026-10-14T12:00:00Z');

    it('lanza 404 si el cliente no existe', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.findOne('biz-x', now)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('arma la ficha con foto, plan, canchas y actividad', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...storedClient,
        description: 'Sintética',
        updatedAt: now,
        owner: { ...storedClient.owner, verified: true, createdAt: now },
        amenities: [{ code: 'WIFI', name: 'WiFi' }],
        profileImage: { id: 'img-1' },
        subscription: {
          since: now,
          nextPayment: now,
          isActive: true,
          autoBilling: true,
          plan: {
            id: 'plan-1',
            name: 'Básico',
            monthlyPrice: 89_000,
            courtLimit: 3,
          },
        },
        courts: [
          {
            id: 'c1',
            name: 'Cancha 1',
            sport: 'FUTBOL',
            isCovered: false,
            currency: 'COP',
            basePricePerHour: 90_000,
            isActive: true,
            photos: [{ slot: 'MAIN' }],
          },
        ],
      });
      prisma.reservation.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 180_000 } });
      prisma.payment.count.mockResolvedValue(1);
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'r1',
          start: now,
          end: now,
          court: { name: 'Cancha 1', currency: 'COP' },
          customerName: 'Camilo',
          totalPrice: 90_000,
          status: 'CONFIRMED',
        },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'p1',
          receivedAt: now,
          customerName: 'Camilo',
          amount: 90_000,
          method: { name: 'Nequi' },
          concept: 'TOTAL',
          status: 'APPROVED',
        },
      ]);

      const detail = await service.findOne('biz-1', now);

      expect(detail.imageUrl).toBe(
        'https://api.test/api/v1/images/business-profile/img-1',
      );
      expect(detail.subscription?.plan.courtLimit).toBe(3);
      expect(detail.stats).toEqual({
        reservationsTotal: 12,
        reservationsLast30Days: 5,
        upcomingReservations: 2,
        approvedRevenueLast30Days: 180_000,
        pendingPayments: 1,
      });
      expect(detail.recentReservations[0].courtName).toBe('Cancha 1');
      expect(detail.recentPayments[0].method).toBe('Nequi');
      expect(detail.courts[0]).toMatchObject({
        basePricePerHour: 90_000,
        isComplete: false,
      });
    });
  });

  it('requireClient lanza 404 si el negocio no existe', async () => {
    prisma.business.count.mockResolvedValue(0);
    await expect(service.requireClient('biz-x')).rejects.toThrow(
      NotFoundException,
    );
    prisma.business.count.mockResolvedValue(1);
    await expect(service.requireClient('biz-1')).resolves.toBeUndefined();
  });
});
