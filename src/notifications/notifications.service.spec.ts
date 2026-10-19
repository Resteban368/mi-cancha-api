import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi, type Mock } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import { createPrismaMock, PrismaMock } from '../../test/support/prisma-mock.js';
import { ReservationSource } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationsService,
  type NewReservationInfo,
} from './notifications.service.js';
import type { PushService } from './push.service.js';

const sub = (id: string) => ({ endpoint: `https://push/${id}`, p256dh: 'p', auth: 'a' });

describe('NotificationsService', () => {
  let prisma: PrismaMock;
  let service: NotificationsService;
  const push: { send: Mock; publicKey: string | null } = { send: vi.fn(), publicKey: 'BKEY' };
  const audit = { log: vi.fn() };

  const reservation = (over: Partial<NewReservationInfo> = {}): NewReservationInfo => ({
    id: 'r-1',
    businessId: 'b-1',
    start: new Date('2030-10-22T23:30:00Z'), // 18:30 en -05:00
    end: new Date('2030-10-23T00:30:00Z'),
    customerName: 'Pedro Pérez',
    court: { name: 'Cancha 1' },
    source: ReservationSource.WEB,
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    push.publicKey = 'BKEY';
    audit.log.mockReset().mockResolvedValue(undefined);
    push.send.mockReset().mockResolvedValue({ delivered: 1, expiredEndpoints: [] });
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      push as unknown as PushService,
      audit as unknown as AuditService,
      { getOrThrow: () => '-05:00' } as unknown as ConfigService,
    );
  });

  it('guarda la suscripción del navegador sin duplicarla y la mueve a la cuenta actual', async () => {
    const dto = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(16) } };
    await service.subscribe('u-1', dto, 'Mozilla/5.0');
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: dto.endpoint },
        create: expect.objectContaining({ userId: 'u-1', p256dh: dto.keys.p256dh, auth: dto.keys.auth }),
        update: expect.objectContaining({ userId: 'u-1', lastSeenAt: expect.any(Date) }),
      }),
    );
  });

  it('al desactivar solo quita la suscripción de esa cuenta', async () => {
    await service.unsubscribe('u-1', 'https://push.example/abc');
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', endpoint: 'https://push.example/abc' },
    });
  });

  it('avisa al dueño del negocio con cliente, cancha y hora local', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a'), sub('b')]);
    await service.notifyNewReservation(reservation());

    expect(prisma.pushSubscription.findMany.mock.calls[0][0].where).toEqual({
      user: { business: { id: 'b-1' } },
    });
    const [targets, message] = push.send.mock.calls[0];
    expect(targets.map((t: { endpoint: string }) => t.endpoint)).toEqual(['https://push/a', 'https://push/b']);
    expect(message.title).toBe('Nueva reserva');
    expect(message.body).toContain('Pedro Pérez');
    expect(message.body).toContain('Cancha 1');
    expect(message.body).toMatch(/6:30/);
    expect(message.url).toBe('/negocio/reservas');
    expect(message.data).toMatchObject({ type: 'NEW_RESERVATION', reservationId: 'r-1' });
  });

  it('en una reserva de varias canchas dice cuántas son', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a')]);
    await service.notifyNewReservation(reservation({ courtCount: 3 }));
    expect(push.send.mock.calls[0][1].body).toContain('3 canchas');
  });

  it('no avisa de las reservas que creó el propio negocio', async () => {
    await service.notifyNewReservation(reservation({ source: ReservationSource.BUSINESS }));
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
  });

  it('sin dispositivos registrados no envía nada', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([]);
    await service.notifyNewReservation(reservation());
    expect(push.send).not.toHaveBeenCalled();
  });

  it('borra las suscripciones que el navegador ya no acepta', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a'), sub('viejo')]);
    push.send.mockResolvedValue({ expiredEndpoints: ['https://push/viejo'] });
    await service.notifyNewReservation(reservation());
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push/viejo'] } },
    });
  });

  it('si el envío falla no lanza error: la reserva ya está guardada', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([sub('a')]);
    push.send.mockRejectedValue(new Error('servicio push caído'));
    await expect(service.notifyNewReservation(reservation())).resolves.toBeUndefined();
  });

  describe('aviso del super admin', () => {
    const ADMIN = 'sa-1';
    const subs = [
      { userId: 'u-1', ...sub('a') },
      { userId: 'u-1', ...sub('b') },
      { userId: 'u-2', ...sub('c') },
    ];

    it('a todos: busca a los dueños activos de cualquier negocio, envía y audita', async () => {
      prisma.business.count.mockResolvedValue(5);
      prisma.pushSubscription.findMany.mockResolvedValue(subs);
      push.send.mockResolvedValue({ delivered: 3, expiredEndpoints: [] });

      const result = await service.broadcast(
        ADMIN,
        { title: ' Hola ', body: 'Mantenimiento', all: true },
        '203.0.113.9',
      );

      expect(prisma.pushSubscription.findMany.mock.calls[0][0].where.user).toMatchObject({
        role: 'ADMIN_NEGOCIO',
        bannedAt: null,
        business: { isNot: null },
      });
      expect(push.send.mock.calls[0][1]).toMatchObject({
        title: 'Hola',
        body: 'Mantenimiento',
        url: '/',
        data: { type: 'ADMIN_BROADCAST' },
      });
      expect(result).toEqual({ businesses: 5, reachable: 2, delivered: 3 });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'notification.broadcast',
          actor: { id: ADMIN, role: 'SUPER_ADMIN' },
          ip: '203.0.113.9',
          metadata: expect.objectContaining({ scope: 'ALL', businesses: 5, reachable: 2, delivered: 3 }),
        }),
      );
    });

    it('a los elegidos: filtra por esos negocios', async () => {
      prisma.business.count.mockResolvedValue(2);
      prisma.pushSubscription.findMany.mockResolvedValue([subs[0]]);

      await service.broadcast(ADMIN, { title: 't', body: 'b', all: false, businessIds: ['b-1', 'b-2'] });

      expect(prisma.pushSubscription.findMany.mock.calls[0][0].where.user.business).toEqual({
        id: { in: ['b-1', 'b-2'] },
      });
      expect(audit.log.mock.calls[0][0].metadata).toMatchObject({
        scope: 'SELECTED',
        businessIds: ['b-1', 'b-2'],
      });
    });

    it('rechaza si no eligió a nadie ni marcó "todos", o si algún negocio no existe', async () => {
      await expect(
        service.broadcast(ADMIN, { title: 't', body: 'b', all: false, businessIds: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.business.count.mockResolvedValue(1);
      await expect(
        service.broadcast(ADMIN, { title: 't', body: 'b', all: false, businessIds: ['b-1', 'nada'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(push.send).not.toHaveBeenCalled();
    });

    it('si el servidor no tiene claves VAPID responde 503 y no envía', async () => {
      push.publicKey = null;
      await expect(
        service.broadcast(ADMIN, { title: 't', body: 'b', all: true }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('sin nadie con avisos activados no llama al servicio push, pero lo audita', async () => {
      prisma.business.count.mockResolvedValue(4);
      prisma.pushSubscription.findMany.mockResolvedValue([]);
      const result = await service.broadcast(ADMIN, { title: 't', body: 'b', all: true });
      expect(push.send).not.toHaveBeenCalled();
      expect(result).toEqual({ businesses: 4, reachable: 0, delivered: 0 });
      expect(audit.log).toHaveBeenCalled();
    });

    it('borra las suscripciones vencidas que descubre al enviar', async () => {
      prisma.business.count.mockResolvedValue(1);
      prisma.pushSubscription.findMany.mockResolvedValue([subs[0]]);
      push.send.mockResolvedValue({ delivered: 0, expiredEndpoints: ['https://push/a'] });
      await service.broadcast(ADMIN, { title: 't', body: 'b', all: true });
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: { in: ['https://push/a'] } },
      });
    });

    it('lista los negocios con sus navegadores suscritos', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'b-1', name: 'El Golazo', owner: { displayName: 'Ana', bannedAt: null, _count: { pushSubscriptions: 2 } } },
        { id: 'b-2', name: 'La Cancha', owner: { displayName: 'Luis', bannedAt: new Date(), _count: { pushSubscriptions: 0 } } },
      ]);
      await expect(service.recipients()).resolves.toEqual([
        { businessId: 'b-1', name: 'El Golazo', ownerName: 'Ana', devices: 2, banned: false },
        { businessId: 'b-2', name: 'La Cancha', ownerName: 'Luis', devices: 0, banned: true },
      ]);
    });
  });
});
