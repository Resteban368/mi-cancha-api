import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReservationSource } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
