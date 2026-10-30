import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { vi } from 'vitest';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { ClientsService } from './clients.service.js';

const dto = {
  fullName: 'Marcela Ruiz',
  email: 'Marcela@Norte.co',
  password: 'secreta123',
  businessName: 'Canchas del Norte',
  address: 'Calle 1',
  neighborhood: 'La Floresta',
  cityId: 'city-1',
  planId: 'plan-1',
};

const storedClient = {
  id: 'biz-1',
  name: dto.businessName,
  address: dto.address,
  neighborhood: dto.neighborhood,
  city: {
    id: 'city-1',
    name: 'Medellín',
    department: { id: 'dep-1', name: 'Antioquia' },
  },
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
  let storage: { delete: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createPrismaMock();
    storage = { delete: vi.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FileStorage, useValue: storage },
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
    prisma.city.count.mockResolvedValue(1);

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
    expect(data.city).toEqual({ connect: { id: 'city-1' } });
    expect(result.city).toEqual({
      id: 'city-1',
      name: 'Medellín',
      department: { id: 'dep-1', name: 'Antioquia' },
    });
    expect(result.plan?.name).toBe('Básico');
  });

  it('rechaza una ciudad que no está en el catálogo de Colombia', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1' });
    prisma.city.count.mockResolvedValue(0);
    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    expect(prisma.business.create).not.toHaveBeenCalled();
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

  describe('plan por canchas', () => {
    const mainPlan = {
      id: 'plan-main',
      name: 'Mi Cancha',
      monthlyPrice: 79_000,
      courtLimit: 20,
      pricedByCourts: true,
    };
    const updatedClient = {
      ...storedClient,
      subscription: {
        ...storedClient.subscription,
        courts: 3,
        plan: mainPlan,
      },
    };

    it('al asignarlo contrata por defecto las canchas activas', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        subscription: { courts: null, plan: { pricedByCourts: false } },
        _count: { courts: 4 },
      });
      prisma.plan.findUnique.mockResolvedValue(mainPlan);
      prisma.business.findUniqueOrThrow.mockResolvedValue(updatedClient);

      await service.updateSubscription('biz-1', { planId: 'plan-main' });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'plan-main', courts: 4 }),
        }),
      );
    });

    it('devuelve el precio y el límite de las canchas contratadas', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        subscription: { courts: 2, plan: mainPlan },
        _count: { courts: 2 },
      });
      prisma.business.findUniqueOrThrow.mockResolvedValue(updatedClient);

      const result = await service.updateSubscription('biz-1', { courts: 3 });

      expect(result.plan).toMatchObject({
        monthlyPrice: 117_000,
        courtLimit: 3,
      });
    });

    it('rechaza indicar canchas en otro plan', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        subscription: {
          courts: null,
          plan: { name: 'Prueba', pricedByCourts: false },
        },
        _count: { courts: 1 },
      });
      await expect(
        service.updateSubscription('biz-1', { courts: 3 }),
      ).rejects.toThrow(ConflictException);
    });
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
        profileImages: [{ id: 'img-1' }],
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
        isComplete: true,
      });
    });
  });

  describe('update', () => {
    it('actualiza datos y coordenadas del cliente', async () => {
      prisma.business.count.mockResolvedValue(1);
      prisma.business.update.mockResolvedValue({ id: 'biz-1' });
      vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'biz-1' } as any);

      const result = await service.update('biz-1', {
        name: 'Nuevo Nombre',
        address: 'Calle 100 # 15-20',
        neighborhood: 'Chicó',
        latitude: 4.6789,
        longitude: -74.0567,
      });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        data: {
          name: 'Nuevo Nombre',
          address: 'Calle 100 # 15-20',
          neighborhood: 'Chicó',
          latitude: 4.6789,
          longitude: -74.0567,
        },
      });
      expect(result.id).toBe('biz-1');
    });

    it('falla si se envía latitud sin longitud', async () => {
      prisma.business.count.mockResolvedValue(1);
      await expect(
        service.update('biz-1', { latitude: 4.6789, longitude: null }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateOwner', () => {
    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'biz-1' } as any);
    });

    it('edita nombre, correo (en minúsculas) y celular', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      await service.updateOwner('biz-1', {
        fullName: 'Ana Pérez',
        email: 'ANA@Golazo.co',
        phone: ' 3001234567 ',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
        data: {
          displayName: 'Ana Pérez',
          email: 'ana@golazo.co',
          phone: '3001234567',
        },
      });
    });

    it('rechaza un correo que ya usa otra cuenta', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'otro' });
      await expect(
        service.updateOwner('biz-1', { email: 'dup@golazo.co' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('permite dejar el mismo correo de siempre', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'owner-1' });
      await service.updateOwner('biz-1', { email: 'mismo@golazo.co' });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('rechaza un celular que ya usa otro responsable', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'otro' });
      await expect(
        service.updateOwner('biz-1', { phone: '3001234567' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza 404 si el cliente no existe', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(
        service.updateOwner('x', { fullName: 'Ana' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const stored = {
      ownerId: 'owner-1',
      owner: { role: UserRole.ADMIN_NEGOCIO },
      profileImages: [{ storagePath: 'biz/cover.jpg' }],
      courts: [{ photos: [{ storagePath: 'courts/c1/main.jpg' }] }],
    };

    it('borra reservas y la cuenta del responsable, y luego las fotos', async () => {
      prisma.business.findUnique.mockResolvedValue(stored);
      await service.remove('biz-1');
      expect(prisma.reservation.deleteMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith('biz/cover.jpg');
      expect(storage.delete).toHaveBeenCalledWith('courts/c1/main.jpg');
    });

    it('si falla borrar una foto, igual elimina el cliente', async () => {
      prisma.business.findUnique.mockResolvedValue(stored);
      storage.delete.mockRejectedValue(new Error('koofr caído'));
      await expect(service.remove('biz-1')).resolves.toBeUndefined();
    });

    it('no elimina cuentas que no son de negocio', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...stored,
        owner: { role: UserRole.SUPER_ADMIN },
      });
      await expect(service.remove('biz-1')).rejects.toThrow(ConflictException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('lanza 404 si el cliente no existe', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateModules', () => {
    beforeEach(() => {
      vi.spyOn(service, 'requireClient').mockResolvedValue();
      vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'biz-1' } as any);
    });

    it('activar guarda la fecha de activación', async () => {
      prisma.business.findUniqueOrThrow.mockResolvedValue({
        salesModuleEnabled: false,
      });
      await service.updateModules('biz-1', { sales: true });
      const { data } = prisma.business.update.mock.calls[0][0];
      expect(data.salesModuleEnabled).toBe(true);
      expect(data.salesModuleEnabledAt).toBeInstanceOf(Date);
    });

    it('desactivar borra la fecha', async () => {
      prisma.business.findUniqueOrThrow.mockResolvedValue({
        salesModuleEnabled: true,
      });
      await service.updateModules('biz-1', { sales: false });
      expect(prisma.business.update.mock.calls[0][0].data).toEqual({
        salesModuleEnabled: false,
        salesModuleEnabledAt: null,
      });
    });

    it('si no cambia, no toca la fecha', async () => {
      prisma.business.findUniqueOrThrow.mockResolvedValue({
        salesModuleEnabled: true,
      });
      await service.updateModules('biz-1', { sales: true });
      expect(prisma.business.update).not.toHaveBeenCalled();
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
