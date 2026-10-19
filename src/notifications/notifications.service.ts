import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { pageArgs, type PageQueryDto } from '../common/dto/page.dto.js';
import {
  AuditCategory,
  NotificationType,
  ReservationSource,
  UserRole,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BroadcastDto,
  BroadcastRecipientDto,
  BroadcastResultDto,
} from './dto/broadcast.dto.js';
import type {
  BroadcastHistoryPageDto,
  InboxPageDto,
  InboxQueryDto,
  NotificationDto,
} from './dto/inbox.dto.js';
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

function toNotificationDto(row: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  data: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    data: (row.data as Record<string, unknown> | null) ?? null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

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

  /** Quita la suscripción de un navegador por su endpoint, sin importar de quién sea. */
  async forgetEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
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
    const business = await this.prisma.business.findUnique({
      where: { id: reservation.businessId },
      select: { ownerId: true },
    });
    if (!business) return;

    const courts =
      reservation.courtCount && reservation.courtCount > 1
        ? `${reservation.courtCount} canchas`
        : reservation.court.name;
    const title = 'Nueva reserva';
    const body = `${reservation.customerName} · ${courts} · ${this.when(reservation.start)}`;
    const url = '/negocio/reservas';

    // Queda en la bandeja del dueño aunque no tenga el push activado.
    const notification = await this.prisma.notification.create({
      data: {
        userId: business.ownerId,
        type: NotificationType.NEW_RESERVATION,
        title,
        body,
        url,
        data: { reservationId: reservation.id },
      },
      select: { id: true },
    });

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: business.ownerId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) return;

    const { expiredEndpoints } = await this.push.send(subscriptions, {
      title,
      body,
      url,
      tag: `reserva-${reservation.id}`,
      data: {
        type: NotificationType.NEW_RESERVATION,
        reservationId: reservation.id,
        notificationId: notification.id,
      },
    });
    await this.forgetExpired(expiredEndpoints);
  }

  private async forgetExpired(endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return;
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: endpoints } },
    });
  }

  // ---------- Bandeja del negocio ----------

  async inbox(userId: string, query: InboxQueryDto): Promise<InboxPageDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread ? { readAt: null } : {}),
    };
    const [total, unread, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query as PageQueryDto),
      }),
    ]);
    return {
      items: rows.map(toNotificationDto),
      total,
      unread,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Idempotente: marcar una que ya estaba leída (o que no es suya) no hace nada. */
  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
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

    const owners = await this.prisma.business.findMany({
      where: dto.all ? {} : { id: { in: ids } },
      select: { ownerId: true, owner: { select: { bannedAt: true } } },
    });
    const businesses = owners.length;
    if (!dto.all && businesses !== ids.length) {
      throw new BadRequestException('Alguno de los negocios elegidos no existe');
    }
    // Las cuentas bloqueadas no pueden entrar: ni bandeja ni push.
    const ownerIds = owners.filter((o) => !o.owner.bannedAt).map((o) => o.ownerId);

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: ownerIds } },
      select: { userId: true, endpoint: true, p256dh: true, auth: true },
    });
    const reachable = new Set(subscriptions.map((s) => s.userId)).size;

    const title = dto.title.trim();
    const body = dto.body.trim();
    const url = dto.url ?? '/';
    const sender = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { displayName: true },
    });
    const sentByLabel = sender?.displayName ?? null;

    // Primero el historial y las bandejas: el aviso queda aunque el push falle.
    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        sentById: adminId,
        sentByLabel,
        title,
        body,
        url,
        scope: dto.all ? 'ALL' : 'SELECTED',
        targeted: businesses,
        reachable,
        delivered: 0,
      },
      select: { id: true },
    });
    if (ownerIds.length > 0) {
      await this.prisma.notification.createMany({
        data: ownerIds.map((userId) => ({
          userId,
          type: NotificationType.ADMIN_BROADCAST,
          title,
          body,
          url,
          broadcastId: broadcast.id,
        })),
      });
    }

    let delivered = 0;
    if (subscriptions.length > 0) {
      const result = await this.push.send(subscriptions, {
        title,
        body,
        url,
        tag: `aviso-${broadcast.id}`,
        data: { type: NotificationType.ADMIN_BROADCAST, broadcastId: broadcast.id },
      });
      delivered = result.delivered;
      await this.forgetExpired(result.expiredEndpoints);
      await this.prisma.notificationBroadcast.update({
        where: { id: broadcast.id },
        data: { delivered },
      });
    }

    await this.audit.log({
      category: AuditCategory.ADMIN,
      action: 'notification.broadcast',
      actor: { id: adminId, role: UserRole.SUPER_ADMIN },
      entityType: 'Notification',
      entityId: broadcast.id,
      metadata: {
        title,
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

  /** Historial de avisos enviados, del más reciente al más antiguo. */
  async broadcasts(query: PageQueryDto): Promise<BroadcastHistoryPageDto> {
    const [total, rows] = await Promise.all([
      this.prisma.notificationBroadcast.count(),
      this.prisma.notificationBroadcast.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
    ]);
    const reads = await this.prisma.notification.groupBy({
      by: ['broadcastId'],
      where: { broadcastId: { in: rows.map((r) => r.id) }, readAt: { not: null } },
      _count: { _all: true },
    });
    const read = new Map(reads.map((r) => [r.broadcastId, r._count._all]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        url: r.url,
        scope: r.scope,
        sentByLabel: r.sentByLabel,
        targeted: r.targeted,
        reachable: r.reachable,
        delivered: r.delivered,
        read: read.get(r.id) ?? 0,
        createdAt: r.createdAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
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
