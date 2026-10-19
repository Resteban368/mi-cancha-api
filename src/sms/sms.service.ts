import { Logger, ServiceUnavailableException } from '@nestjs/common';
import twilio from 'twilio';

/**
 * Envío de SMS. Se inyecta por esta clase para poder cambiar de proveedor
 * (Plivo, etc.) sin tocar quien la usa.
 */
export abstract class SmsService {
  /** [to] en formato E.164 (+573001234567). */
  abstract send(to: string, body: string): Promise<void>;
}

export interface TwilioSmsConfig {
  accountSid: string;
  /** API Key (SK…) y su secreto; si no hay, el Auth Token de la cuenta. */
  apiKey?: { sid: string; secret: string };
  authToken?: string;
  /** Número de Twilio (E.164) o Messaging Service SID (MG…). */
  from: string;
}

/** Twilio Messages API con el SDK oficial. */
export class TwilioSmsService extends SmsService {
  private readonly logger = new Logger(TwilioSmsService.name);
  private readonly client: ReturnType<typeof twilio>;

  constructor(
    private readonly config: TwilioSmsConfig,
    client?: ReturnType<typeof twilio>,
  ) {
    super();
    this.client =
      client ??
      (config.apiKey
        ? twilio(config.apiKey.sid, config.apiKey.secret, {
            accountSid: config.accountSid,
          })
        : twilio(config.accountSid, config.authToken));
  }

  async send(to: string, body: string): Promise<void> {
    const sender = this.config.from.startsWith('MG')
      ? { messagingServiceSid: this.config.from }
      : { from: this.config.from };
    try {
      await this.client.messages.create({ to, body, ...sender });
    } catch (error) {
      // Nunca se registra el cuerpo del mensaje (lleva el código).
      const { code, status } = error as { code?: number; status?: number };
      this.logger.error(
        `Twilio no envió el SMS (status ${status}, código ${code})`,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el SMS. Intenta de nuevo en un momento.',
      );
    }
  }
}

/** Desarrollo sin Twilio: no envía nada (y no registra el mensaje, que lleva el código). */
export class DevSmsService extends SmsService {
  private readonly logger = new Logger(DevSmsService.name);

  async send(to: string): Promise<void> {
    this.logger.warn(
      `SMS de prueba para ${to}: Twilio no está configurado, no se envió (usa el código fijo de desarrollo)`,
    );
  }
}

/** Producción sin credenciales de Twilio: falla con un mensaje claro. */
export class UnconfiguredSmsService extends SmsService {
  async send(): Promise<void> {
    throw new ServiceUnavailableException(
      'La verificación por SMS no está disponible en este momento.',
    );
  }
}
