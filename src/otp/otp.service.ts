import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { normalizePhone } from '../customers/customers.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from '../sms/sms.service.js';

/** Reglas de los códigos de un solo uso. */
export const OTP_RULES = {
  /** Minutos de vigencia del código. */
  ttlMinutes: 5,
  /** Intentos fallidos antes de invalidar el código. */
  maxAttempts: 5,
  /** Segundos de espera para pedir otro código al mismo número. */
  cooldownSeconds: 60,
  /** Códigos por número en la ventana: el primero y un solo reenvío. */
  maxPerPhone: 2,
  /** Horas de la ventana de códigos por número. */
  phoneWindowHours: 6,
  /** Códigos por IP en una hora (varias personas pueden compartir una red). */
  maxPerIpPerHour: 10,
} as const;

/** Mensaje igual para todos: no revela si el número tiene cuenta. */
export const OTP_SENT_MESSAGE =
  'Si el número es válido, te enviamos un código por SMS.';

/** Vigencia de la prueba de verificación que devuelve /otp/verify. */
export const VERIFICATION_TOKEN_SECONDS = 600;
const VERIFICATION_PURPOSE = 'phone-verified';

/** Solo celulares de Colombia reciben códigos (evita envíos al exterior). */
const COLOMBIAN_MOBILE = /^\+573\d{9}$/;
const HOUR_MS = 60 * 60 * 1000;

export interface OtpOptions {
  /** HMAC de los códigos y de las IP. */
  secret: string;
  /** Solo en desarrollo sin Twilio: código fijo en lugar de uno aleatorio. */
  fixedCode?: string | null;
}

/** Códigos OTP por SMS: se generan, guardan como HMAC, vencen y se validan aquí. */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly jwt: JwtService,
    private readonly options: OtpOptions,
  ) {}

  /**
   * Genera y envía un código al celular. Cada número tiene 2 códigos cada 6
   * horas (el primero y un reenvío), con 60 s entre ellos, y cada IP un tope
   * por hora; el código anterior deja de servir.
   */
  async request(rawPhone: string, ip?: string | null, now = new Date()) {
    const phone = otpPhone(rawPhone);
    const ipHash = ip ? this.hmac(`ip:${ip}`) : null;
    const hourAgo = new Date(now.getTime() - HOUR_MS);
    const windowStart = new Date(
      now.getTime() - OTP_RULES.phoneWindowHours * HOUR_MS,
    );

    const [sent, perIp] = await Promise.all([
      // Códigos de este número en la ventana, del más antiguo al más nuevo.
      this.prisma.otpCode.findMany({
        where: { phone, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      ipHash
        ? this.prisma.otpCode.count({
            where: { ipHash, createdAt: { gte: hourAgo } },
          })
        : 0,
    ]);
    if (sent.length >= OTP_RULES.maxPerPhone) {
      // Se libera cuando el más antiguo sale de la ventana de 6 horas.
      const freeAt =
        sent[0].createdAt.getTime() + OTP_RULES.phoneWindowHours * HOUR_MS;
      throw tooMany(
        `Ya pediste ${OTP_RULES.maxPerPhone} códigos para este celular. ` +
          `Podrás pedir otro en ${formatWait(freeAt - now.getTime())}.`,
      );
    }
    const last = sent.at(-1);
    const waited = last
      ? (now.getTime() - last.createdAt.getTime()) / 1000
      : Infinity;
    if (waited < OTP_RULES.cooldownSeconds) {
      const seconds = Math.ceil(OTP_RULES.cooldownSeconds - waited);
      throw tooMany(`Espera ${seconds} segundos para pedir otro código.`);
    }
    if (perIp >= OTP_RULES.maxPerIpPerHour) {
      throw tooMany(
        'Se pidieron demasiados códigos desde esta conexión. Intenta de nuevo en una hora.',
      );
    }

    const code =
      this.options.fixedCode ??
      String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Solo vale el último código pedido.
    await this.prisma.otpCode.updateMany({
      where: { phone, usedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
    const otp = await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: this.codeHash(phone, code),
        ipHash,
        expiresAt: new Date(now.getTime() + OTP_RULES.ttlMinutes * 60_000),
        createdAt: now,
      },
      select: { id: true },
    });
    try {
      await this.sms.send(
        phone,
        `Tu código de verificación es ${code}. Vence en ${OTP_RULES.ttlMinutes} minutos.`,
      );
    } catch (error) {
      // Si el SMS no salió, no cuenta para la espera ni para los límites.
      await this.prisma.otpCode.delete({ where: { id: otp.id } });
      throw error;
    }
    return { message: OTP_SENT_MESSAGE };
  }

  /**
   * true si [code] es el vigente para el celular: lo marca como usado (no se
   * puede reutilizar). Cada fallo suma un intento; al quinto se invalida.
   */
  async verify(
    rawPhone: string,
    code: string,
    now = new Date(),
  ): Promise<boolean> {
    const phone = otpPhone(rawPhone);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= OTP_RULES.maxAttempts) return false;

    if (!this.matches(otp.codeHash, this.codeHash(phone, code.trim()))) {
      const attempts = otp.attempts + 1;
      await this.prisma.otpCode.updateMany({
        where: { id: otp.id, usedAt: null },
        data: {
          attempts: { increment: 1 },
          ...(attempts >= OTP_RULES.maxAttempts && { expiresAt: now }),
        },
      });
      return false;
    }
    // updateMany con usedAt: null: si dos validaciones llegan a la vez, solo una gana.
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  }

  /**
   * Prueba firmada de que el celular se verificó. Usa el secreto de los OTP
   * (no el de las sesiones), así nunca sirve como token de sesión.
   */
  issueVerificationToken(rawPhone: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: otpPhone(rawPhone), purpose: VERIFICATION_PURPOSE },
      { secret: this.options.secret, expiresIn: VERIFICATION_TOKEN_SECONDS },
    );
  }

  /**
   * El celular está verificado con [code] (se consume) o con un
   * [verificationToken] de /otp/verify emitido para ese mismo celular.
   */
  async confirm(
    rawPhone: string,
    proof: { code?: string; verificationToken?: string },
  ): Promise<boolean> {
    const phone = otpPhone(rawPhone);
    if (proof.verificationToken) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          purpose: string;
        }>(proof.verificationToken, { secret: this.options.secret });
        return (
          payload.purpose === VERIFICATION_PURPOSE && payload.sub === phone
        );
      } catch {
        return false;
      }
    }
    return proof.code ? this.verify(phone, proof.code) : false;
  }

  private codeHash(phone: string, code: string): string {
    return this.hmac(`otp:${phone}:${code}`);
  }

  private hmac(value: string): string {
    return createHmac('sha256', this.options.secret)
      .update(value)
      .digest('hex');
  }

  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}

/** Celular normalizado a E.164 que puede recibir el código. */
export function otpPhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (!COLOMBIAN_MOBILE.test(phone)) {
    throw new BadRequestException(
      'Usa un celular de Colombia: 10 dígitos que empiezan por 3.',
    );
  }
  return phone;
}

/** "5 h 12 min" o "8 min" (mínimo 1 min). */
function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function tooMany(message: string): HttpException {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}
