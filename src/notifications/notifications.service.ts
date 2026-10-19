import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import {
  AuditCategory,
  ReservationSource,
  UserRole,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BroadcastDto,
  BroadcastRecipientDto,
  BroadcastResultDto,
} from './dto/broadcast.dto.js';
import type { SubscribeDto } from './dto/subscription.dto.js';
import { PushService } from './push.service.js';

/** Lo mínimo de una reserva para avisarle al negocio. */
export interface NewReservationInfo {
  id: string;
  businessId: string;
  start: Date;
  end: Date;
  customerName: string;
  court: { name: string };
  source: ReservationSource;
  /** Reservas de varias canchas: cuántas incluye el grupo. */
  courtCount?: number;
}

/** Tiempo máximo que la reserva espera al envío: nunca debe frenar la respuesta al jugador. */
const SEND_TIMEOUT_MS = 3_000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  /** Guarda (o mueve a esta cuenta) la suscripción de un navegador. Es idempotente. */
  async subscribe(
    userId: string,
    dto: SubscribeDto,
    userAgent?: string,
  ): Promise<void> {
    const data = {
      userId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, 300) ?? null,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { endpoint: dto.endpoint, ...data },
      update: { ...data, lastSeenAt: new Date() },
    });
  }

  /** Quita la suscripción solo si es de esta cuenta (al desactivar los avisos o cerrar sesión). */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  get publicKey(): string | null {
    return this.push.publicKey;
  }

  /**
   * Avisa al dueño del negocio que llegó una reserva hecha por un jugador.
   * Nunca lanza error: si falla, la reserva ya está guardada y solo se registra.
   */
  async notifyNewReservation(reservation: NewReservationInfo): Promise<void> {
    if (reservation.source !== ReservationSource.WEB) return;
    try {
      await Promise.race([
        this.send(reservation),
        new Promise<void>((resolve) =>
          setTimeout(resolve, SEND_TIMEOUT_MS).unref(),
        ),
      ]);
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la reserva ${reservation.id}: ${(error as Error).message}`,
      );
    }
  }

  private async send(reservation: NewReservationInfo): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { user: { business: { id: reservation.businessId } } },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) return;

    const courts =
      reservation.courtCount && reservation.courtCount > 1
        ? `${reservation.courtCount} canchas`
        : reservation.court.name;
    const { expiredEndpoints } = await this.push.send(subscriptions, {
      title: 'Nueva reserva',
      body: `${reservation.customerName} · ${courts} · ${this.when(reservation.start)}`,
      url: '/negocio/reservas',
      tag: `reserva-${reservation.id}`,
      data: { type: 'NEW_RESERVATION', reservationId: reservation.id },
    });
    if (expiredEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
    }
  }

  // ---------- Super admin: aviso a los negocios ----------

  /** Todos los negocios con cuántos navegadores tienen suscritos, para elegir a quién avisar. */
  async recipients(): Promise<BroadcastRecipientDto[]> {
    const businesses = await this.prisma.business.findMany({
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            displayName: true,
            bannedAt: true,
            _count: { select: { pushSubscriptions: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return businesses.map((b) => ({
      businessId: b.id,
      name: b.name,
      ownerName: b.owner.displayName,
      devices: b.owner._count.pushSubscriptions,
      banned: b.owner.bannedAt !== null,
    }));
  }

  /** Aviso del super admin a todos los negocios o a los elegidos. */
  async broadcast(
    adminId: string,
    dto: BroadcastDto,
    ip?: string | null,
  ): Promise<BroadcastResultDto> {
    if (!this.push.publicKey) {
      throw new ServiceUnavailableException(
        'Las notificaciones no están configuradas en el servidor (faltan las claves VAPID)',
      );
    }
    const ids = dto.businessIds ?? [];
    if (!dto.all && ids.length === 0) {
      throw new BadRequestException('Elige al menos un negocio o envía a todos');
    }

    const businesses = await this.prisma.business.count({
      where: dto.all ? {} : { id: { in: ids } },
    });
    if (!dto.all && businesses !== ids.length) {
      throw new BadRequestException('Alguno de los negocios elegidos no existe');
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        user: {
          role: UserRole.ADMIN_NEGOCIO,
          bannedAt: null,
          business: dto.all ? { isNot: null } : { id: { in: ids } },
        },
      },
      select: { userId: true, endpoint: true, p256dh: true, auth: true },
    });
    const reachable = new Set(subscriptions.map((s) => s.userId)).size;

    let delivered = 0;
    if (subscriptions.length > 0) {
      const result = await this.push.send(subscriptions, {
        title: dto.title.trim(),
        body: dto.body.trim(),
        url: dto.url ?? '/',
        tag: `aviso-${randomUUID()}`,
        data: { type: 'ADMIN_BROADCAST' },
      });
      delivered = result.delivered;
      if (result.expiredEndpoints.length > 0) {
        await this.prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: result.expiredEndpoints } },
        });
      }
    }

    await this.audit.log({
      category: AuditCategory.ADMIN,
      action: 'notification.broadcast',
      actor: { id: adminId, role: UserRole.SUPER_ADMIN },
      entityType: 'Notification',
      metadata: {
        title: dto.title.trim(),
        scope: dto.all ? 'ALL' : 'SELECTED',
        businessIds: dto.all ? undefined : ids,
        businesses,
        reachable,
        delivered,
      },
      ip,
    });
    return { businesses, reachable, delivered };
  }

  /** "mar 21 oct, 6:30 p. m." en la hora del negocio. */
  private when(start: Date): string {
    const sign = this.utcOffset.startsWith('-') ? -1 : 1;
    const [h, m] = this.utcOffset.slice(1).split(':').map(Number);
    const local = new Date(start.getTime() + sign * (h * 60 + (m || 0)) * 60_000);
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(local);
  }
}
