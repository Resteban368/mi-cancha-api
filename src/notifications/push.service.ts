import { Logger } from '@nestjs/common';
import webpush from 'web-push';

export interface PushMessage {
  title: string;
  body: string;
  /** Ruta del panel que se abre al tocar el aviso. */
  url?: string;
  /** Mismo valor = el aviso reemplaza al anterior en vez de apilarse. */
  tag?: string;
  data?: Record<string, string>;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  /** Endpoints que el navegador ya no acepta (suscripción vencida o revocada): hay que borrarlos. */
  expiredEndpoints: string[];
}

/**
 * Envío de notificaciones push. Se inyecta por esta clase para poder cambiar
 * de proveedor sin tocar quien la usa.
 */
export abstract class PushService {
  /** Clave pública que el navegador necesita para suscribirse; null si no hay push. */
  abstract readonly publicKey: string | null;
  abstract send(targets: PushTarget[], message: PushMessage): Promise<PushResult>;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  /** mailto: o URL de contacto que exige el protocolo. */
  subject: string;
}

/** Web Push estándar (VAPID): Chrome, Edge, Firefox y Safari 16.4+. */
export class WebPushService extends PushService {
  private readonly logger = new Logger(WebPushService.name);
  readonly publicKey: string;

  constructor(private readonly vapid: VapidConfig) {
    super();
    this.publicKey = vapid.publicKey;
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const payload = JSON.stringify(message);
    const expiredEndpoints: string[] = [];
    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            payload,
            {
              vapidDetails: {
                subject: this.vapid.subject,
                publicKey: this.vapid.publicKey,
                privateKey: this.vapid.privateKey,
              },
              TTL: 60 * 60,
              urgency: 'high',
            },
          );
        } catch (error) {
          const { statusCode } = error as { statusCode?: number };
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(t.endpoint);
          } else {
            this.logger.warn(`El servicio push respondió ${statusCode ?? 'con error'}`);
          }
        }
      }),
    );
    return { expiredEndpoints };
  }
}

/** Desarrollo sin claves VAPID: solo deja un aviso en el log. */
export class DevPushService extends PushService {
  private readonly logger = new Logger(DevPushService.name);
  readonly publicKey = null;

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    this.logger.warn(
      `Push de prueba a ${targets.length} navegador(es): "${message.title}" — faltan las claves VAPID, no se envió`,
    );
    return { expiredEndpoints: [] };
  }
}

/** Producción sin claves: no envía y lo deja claro en el log (la reserva no se afecta). */
export class UnconfiguredPushService extends PushService {
  private readonly logger = new Logger(UnconfiguredPushService.name);
  readonly publicKey = null;

  async send(): Promise<PushResult> {
    this.logger.error(
      'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY: no se envían notificaciones push',
    );
    return { expiredEndpoints: [] };
  }
}
