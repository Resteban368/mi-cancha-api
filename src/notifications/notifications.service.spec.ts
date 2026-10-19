import { ConfigService } from '@nestjs/config';
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
  const push = { send: vi.fn() };

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
    push.send.mockReset().mockResolvedValue({ expiredEndpoints: [] });
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      push as unknown as PushService,
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
});
