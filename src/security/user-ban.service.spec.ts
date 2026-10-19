import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { AuditService } from '../audit/audit.service.js';
import type { BannedUsersService } from '../common/auth/banned-users.service.js';
import {
  AuditCategory,
  ReservationStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ReservationsService } from '../reservations/reservations.service.js';
import { BAN_CANCELLATION_REASON, UserBanService } from './user-ban.service.js';

describe('UserBanService', () => {
  let prisma: PrismaMock;
  let service: UserBanService;
  const reservations = { cancelForBusiness: vi.fn() };
  const bannedUsers = { forget: vi.fn() };
  const audit = { log: vi.fn() };
  const ADMIN = 'sa-1';

  const player = (overrides: Record<string, unknown> = {}) => ({
    id: 'p-1',
    displayName: 'Pedro Jugador',
    role: UserRole.JUGADOR,
    bannedAt: null,
    bannedReason: null,
    business: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    // El servicio usa la forma de arreglo: se ejecutan todas las operaciones.
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    prisma.user.update.mockResolvedValue({});
    prisma.slotHold.deleteMany.mockResolvedValue({ count: 0 });
    reservations.cancelForBusiness.mockReset().mockResolvedValue({});
    bannedUsers.forget.mockReset();
    audit.log.mockReset().mockResolvedValue(undefined);
    service = new UserBanService(
      prisma as unknown as PrismaService,
      reservations as unknown as ReservationsService,
      bannedUsers as unknown as BannedUsersService,
      audit as unknown as AuditService,
    );
  });

  describe('bloquear', () => {
    it('guarda el motivo y quién bloqueó, libera sus apartados, corta su sesión y lo audita', async () => {
      prisma.user.findUnique.mockResolvedValue(player());

      const result = await service.ban(ADMIN, 'p-1', { reason: '  Suplantación  ' }, '203.0.113.9');

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'p-1' });
      expect(data).toMatchObject({
        bannedReason: 'Suplantación',
        bannedById: ADMIN,
        bannedAt: expect.any(Date),
      });
      expect(prisma.slotHold.deleteMany).toHaveBeenCalledWith({ where: { playerId: 'p-1' } });
      expect(bannedUsers.forget).toHaveBeenCalledWith('p-1');
      expect(reservations.cancelForBusiness).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'p-1', cancelledReservations: 0, failedCancellations: 0 });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AuditCategory.ADMIN,
          action: 'user.banned',
          actor: { id: ADMIN, role: UserRole.SUPER_ADMIN },
          entityType: 'User',
          entityId: 'p-1',
          ip: '203.0.113.9',
          metadata: expect.objectContaining({
            reason: 'Suplantación',
            role: UserRole.JUGADOR,
            cancelFutureReservations: false,
          }),
        }),
      );
    });

    it('si el admin lo pide, cancela las reservas futuras con el flujo normal y salta las que ya se cancelaron con su grupo', async () => {
      prisma.user.findUnique.mockResolvedValue(player());
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'r-1', businessId: 'b-1' },
        { id: 'r-2', businessId: 'b-1' },
      ]);
      reservations.cancelForBusiness
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new ConflictException('ya cancelada con su grupo'));
      // Primero lo cancelado, luego lo que sigue confirmado.
      prisma.reservation.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

      const result = await service.ban(ADMIN, 'p-1', {
        reason: 'Fraude',
        cancelFutureReservations: true,
      });

      expect(prisma.reservation.findMany.mock.calls[0][0].where).toMatchObject({
        playerId: 'p-1',
        status: ReservationStatus.CONFIRMED,
        start: { gt: expect.any(Date) },
      });
      expect(reservations.cancelForBusiness).toHaveBeenCalledTimes(2);
      expect(reservations.cancelForBusiness).toHaveBeenCalledWith(
        'b-1',
        'r-1',
        { reason: BAN_CANCELLATION_REASON },
        ADMIN,
      );
      expect(result).toMatchObject({ cancelledReservations: 2, failedCancellations: 0 });
      expect(audit.log.mock.calls[0][0].metadata).toMatchObject({
        cancelFutureReservations: true,
        cancelledReservations: 2,
      });
    });

    it('si una cancelación falla de verdad, sigue con las demás y la reporta como fallida', async () => {
      prisma.user.findUnique.mockResolvedValue(player());
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'r-1', businessId: 'b-1' },
        { id: 'r-2', businessId: 'b-1' },
      ]);
      reservations.cancelForBusiness
        .mockRejectedValueOnce(new Error('base caída'))
        .mockResolvedValueOnce({});
      prisma.reservation.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const result = await service.ban(ADMIN, 'p-1', {
        reason: 'Fraude',
        cancelFutureReservations: true,
      });

      expect(reservations.cancelForBusiness).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({ cancelledReservations: 1, failedCancellations: 1 });
    });

    it('en un negocio, las reservas a cancelar son las de su negocio', async () => {
      prisma.user.findUnique.mockResolvedValue(
        player({ id: 'n-1', role: UserRole.ADMIN_NEGOCIO, business: { name: 'El Golazo' } }),
      );
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.count.mockResolvedValue(0);

      await service.ban(ADMIN, 'n-1', { reason: 'Mora', cancelFutureReservations: true });

      expect(prisma.reservation.findMany.mock.calls[0][0].where).toMatchObject({
        business: { ownerId: 'n-1' },
        status: ReservationStatus.CONFIRMED,
      });
      expect(prisma.reservation.findMany.mock.calls[0][0].where).not.toHaveProperty('playerId');
    });

    it('no bloquea a un super admin', async () => {
      prisma.user.findUnique.mockResolvedValue(player({ role: UserRole.SUPER_ADMIN }));

      await expect(service.ban(ADMIN, 'p-1', { reason: 'x'.repeat(5) })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('no repite el bloqueo de una cuenta ya bloqueada ni inventa usuarios', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(player({ bannedAt: new Date() }));
      await expect(service.ban(ADMIN, 'p-1', { reason: 'otra vez' })).rejects.toBeInstanceOf(
        ConflictException,
      );

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.ban(ADMIN, 'nadie', { reason: 'no existe' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('desbloquear', () => {
    it('limpia el bloqueo, corta lo recordado y deja el rastro del motivo anterior', async () => {
      const bannedAt = new Date('2026-10-01T10:00:00Z');
      prisma.user.findUnique.mockResolvedValue(player({ bannedAt, bannedReason: 'Fraude' }));

      await service.unban(ADMIN, 'p-1', '203.0.113.9');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { bannedAt: null, bannedReason: null, bannedById: null },
      });
      expect(bannedUsers.forget).toHaveBeenCalledWith('p-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.unbanned',
          entityId: 'p-1',
          metadata: expect.objectContaining({ previousReason: 'Fraude', bannedAt }),
        }),
      );
    });

    it('no desbloquea una cuenta que no está bloqueada', async () => {
      prisma.user.findUnique.mockResolvedValue(player());
      await expect(service.unban(ADMIN, 'p-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  it('la vista previa dice a quién y cuántas reservas futuras se cancelarían', async () => {
    prisma.user.findUnique.mockResolvedValue(
      player({ id: 'n-1', role: UserRole.ADMIN_NEGOCIO, business: { name: 'El Golazo' } }),
    );
    prisma.reservation.count.mockResolvedValue(7);

    await expect(service.preview('n-1')).resolves.toMatchObject({
      id: 'n-1',
      role: UserRole.ADMIN_NEGOCIO,
      businessName: 'El Golazo',
      bannedAt: null,
      futureReservations: 7,
    });
  });
});
