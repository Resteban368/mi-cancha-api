import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { BannedUsersService } from '../common/auth/banned-users.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AuditCategory,
  ReservationStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import { BanPreviewDto, BanResultDto, BanUserDto } from './dto/ban.dto.js';

/** Motivo que ven el negocio y el jugador en las reservas canceladas por un bloqueo. */
export const BAN_CANCELLATION_REASON =
  'Cancelada porque la cuenta fue bloqueada por el administrador';

type BannableUser = Prisma.UserGetPayload<{
  include: { business: { select: { name: true } } };
}>;

/** Bloquear y desbloquear cuentas de jugadores y de negocios (nunca de super admins). */
@Injectable()
export class UserBanService {
  private readonly logger = new Logger(UserBanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly bannedUsers: BannedUsersService,
    private readonly audit: AuditService,
  ) {}

  /** Qué pasaría al bloquear: a quién y cuántas reservas futuras se cancelarían. */
  async preview(userId: string): Promise<BanPreviewDto> {
    const user = await this.requireBannable(userId);
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      businessName: user.business?.name ?? null,
      bannedAt: user.bannedAt,
      bannedReason: user.bannedReason,
      futureReservations: await this.prisma.reservation.count({
        where: this.futureWhere(user, new Date()),
      }),
    };
  }

  async ban(
    adminId: string,
    userId: string,
    dto: BanUserDto,
    ip?: string | null,
  ): Promise<BanResultDto> {
    const user = await this.requireBannable(userId);
    if (user.bannedAt) {
      throw new ConflictException('Esta cuenta ya está bloqueada');
    }
    const reason = dto.reason.trim();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { bannedAt: now, bannedReason: reason, bannedById: adminId },
      }),
      // Los turnos que tenía apartados mientras reservaba vuelven a quedar libres.
      this.prisma.slotHold.deleteMany({ where: { playerId: user.id } }),
    ]);
    this.bannedUsers.forget(user.id);

    let cancelled = 0;
    let failed = 0;
    if (dto.cancelFutureReservations) {
      ({ cancelled, failed } = await this.cancelFutureReservations(user, adminId, now));
    }

    await this.audit.log({
      category: AuditCategory.ADMIN,
      action: 'user.banned',
      actor: { id: adminId, role: UserRole.SUPER_ADMIN },
      entityType: 'User',
      entityId: user.id,
      metadata: {
        target: user.displayName,
        role: user.role,
        reason,
        cancelFutureReservations: Boolean(dto.cancelFutureReservations),
        cancelledReservations: cancelled,
        failedCancellations: failed,
      },
      ip,
    });
    return {
      id: user.id,
      bannedAt: now,
      cancelledReservations: cancelled,
      failedCancellations: failed,
    };
  }

  async unban(adminId: string, userId: string, ip?: string | null): Promise<void> {
    const user = await this.requireBannable(userId);
    if (!user.bannedAt) {
      throw new ConflictException('Esta cuenta no está bloqueada');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { bannedAt: null, bannedReason: null, bannedById: null },
    });
    this.bannedUsers.forget(user.id);

    await this.audit.log({
      category: AuditCategory.ADMIN,
      action: 'user.unbanned',
      actor: { id: adminId, role: UserRole.SUPER_ADMIN },
      entityType: 'User',
      entityId: user.id,
      metadata: {
        target: user.displayName,
        role: user.role,
        previousReason: user.bannedReason,
        bannedAt: user.bannedAt,
      },
      ip,
    });
  }

  /**
   * Cancela una a una con el flujo normal (devoluciones incluidas). Una reserva de
   * varias canchas se cancela entera con la primera, así que las que ya no están
   * confirmadas se saltan. El resultado se cuenta desde la base.
   */
  private async cancelFutureReservations(
    user: BannableUser,
    adminId: string,
    startedAt: Date,
  ): Promise<{ cancelled: number; failed: number }> {
    const targets = await this.prisma.reservation.findMany({
      where: this.futureWhere(user, startedAt),
      select: { id: true, businessId: true },
      orderBy: { start: 'asc' },
    });
    for (const target of targets) {
      try {
        await this.reservations.cancelForBusiness(
          target.businessId,
          target.id,
          { reason: BAN_CANCELLATION_REASON },
          adminId,
        );
      } catch (error) {
        if (error instanceof ConflictException || error instanceof NotFoundException) {
          continue;
        }
        this.logger.error(
          `No se pudo cancelar la reserva ${target.id} al bloquear ${user.id}: ${(error as Error).message}`,
        );
      }
    }
    const [cancelled, failed] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          ...this.scope(user),
          status: ReservationStatus.CANCELLED,
          cancelledById: adminId,
          cancelledAt: { gte: startedAt },
        },
      }),
      this.prisma.reservation.count({ where: this.futureWhere(user, startedAt) }),
    ]);
    return { cancelled, failed };
  }

  /** Reservas del jugador o, si es un negocio, de su negocio. */
  private scope(user: BannableUser): Prisma.ReservationWhereInput {
    return user.role === UserRole.JUGADOR
      ? { playerId: user.id }
      : { business: { ownerId: user.id } };
  }

  private futureWhere(user: BannableUser, now: Date): Prisma.ReservationWhereInput {
    return {
      ...this.scope(user),
      status: ReservationStatus.CONFIRMED,
      start: { gt: now },
    };
  }

  private async requireBannable(userId: string): Promise<BannableUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { business: { select: { name: true } } },
    });
    if (!user) throw new NotFoundException('El usuario no existe');
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('No se puede bloquear a un super admin');
    }
    return user;
  }
}
