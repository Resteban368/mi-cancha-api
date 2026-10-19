import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SmsService } from '../sms/sms.service.js';
import { OTP_RULES, OTP_SENT_MESSAGE, OtpService } from './otp.service.js';

const secret = 's'.repeat(32);
const phone = '+573001234567';
const now = new Date('2030-01-01T12:00:00Z');
const hashOf = (code: string) =>
  createHmac('sha256', secret).update(`otp:${phone}:${code}`).digest('hex');

describe('OtpService', () => {
  let prisma: PrismaMock;
  const sms = { send: vi.fn() };
  const jwt = new JwtService({});
  let service: OtpService;

  beforeEach(() => {
    prisma = createPrismaMock();
    sms.send.mockReset().mockResolvedValue(undefined);
    prisma.otpCode.findFirst.mockResolvedValue(null);
    prisma.otpCode.findMany.mockResolvedValue([]);
    prisma.otpCode.count.mockResolvedValue(0);
    prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    service = new OtpService(
      prisma as unknown as PrismaService,
      sms as unknown as SmsService,
      jwt,
      { secret },
    );
  });

  describe('request', () => {
    it('genera 6 dígitos, guarda solo el hash, vence en 5 min y envía el SMS', async () => {
      const result = await service.request('300 123 4567', '1.2.3.4', now);

      expect(result).toEqual({ message: OTP_SENT_MESSAGE });
      const [to, body] = sms.send.mock.calls[0];
      expect(to).toBe(phone);
      const code = /es (\d{6})\. Vence en 5 minutos\.$/.exec(body)?.[1];
      expect(code).toMatch(/^\d{6}$/);

      const { data } = prisma.otpCode.create.mock.calls[0][0];
      expect(data.codeHash).toBe(hashOf(code!));
      expect(JSON.stringify(data)).not.toContain(code);
      expect(data.ipHash).not.toContain('1.2.3.4');
      expect(data.expiresAt).toEqual(new Date('2030-01-01T12:05:00Z'));
      // El código anterior deja de servir.
      expect(prisma.otpCode.updateMany.mock.calls[0][0]).toMatchObject({
        where: { phone, usedAt: null },
        data: { expiresAt: now },
      });
    });

    it('espera 60 s entre el primer código y el reenvío', async () => {
      prisma.otpCode.findMany.mockResolvedValue([
        { createdAt: new Date(now.getTime() - 20_000) },
      ]);
      const error = await service.request(phone, null, now).catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(429);
      expect(error.message).toContain('Espera 40 segundos');
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('permite un solo reenvío: 2 códigos por celular cada 6 horas', async () => {
      expect(OTP_RULES.maxPerPhone).toBe(2);
      // El reenvío (segundo código) pasa, si ya esperó los 60 s.
      prisma.otpCode.findMany.mockResolvedValue([
        { createdAt: new Date(now.getTime() - 90_000) },
      ]);
      await service.request(phone, null, now);
      expect(sms.send).toHaveBeenCalledTimes(1);
      expect(prisma.otpCode.findMany.mock.calls[0][0].where).toEqual({
        phone,
        createdAt: { gte: new Date('2030-01-01T06:00:00Z') },
      });

      // El tercero no: dice cuánto falta para que salga el primero de la ventana.
      prisma.otpCode.findMany.mockResolvedValue([
        { createdAt: new Date('2030-01-01T10:30:00Z') },
        { createdAt: new Date('2030-01-01T11:00:00Z') },
      ]);
      const error = await service.request(phone, null, now).catch((e) => e);
      expect(error.getStatus()).toBe(429);
      expect(error.message).toBe(
        'Ya pediste 2 códigos para este celular. Podrás pedir otro en 4 h 30 min.',
      );
      expect(sms.send).toHaveBeenCalledTimes(1);
    });

    it('limita los códigos por IP en una hora', async () => {
      prisma.otpCode.count.mockResolvedValue(OTP_RULES.maxPerIpPerHour);
      await expect(service.request(phone, '1.2.3.4', now)).rejects.toThrow(
        'desde esta conexión',
      );
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('si el SMS falla, borra el código para no bloquear el reintento', async () => {
      sms.send.mockRejectedValue(new Error('twilio caído'));
      await expect(service.request(phone, null, now)).rejects.toThrow(
        'twilio caído',
      );
      expect(prisma.otpCode.delete).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
      });
    });

    it('solo acepta celulares de Colombia', async () => {
      await expect(service.request('+14155550100', null, now)).rejects.toThrow(
        'celular de Colombia',
      );
    });
  });

  describe('verify', () => {
    const stored = (overrides: Record<string, unknown> = {}) => ({
      id: 'otp-1',
      phone,
      codeHash: hashOf('123456'),
      attempts: 0,
      usedAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      ...overrides,
    });

    it('código correcto: lo marca como usado', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(stored());
      await expect(service.verify(phone, '123456', now)).resolves.toBe(true);
      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'otp-1', usedAt: null },
        data: { usedAt: now },
      });
      // Solo busca códigos sin usar y vigentes.
      expect(prisma.otpCode.findFirst.mock.calls[0][0].where).toEqual({
        phone,
        usedAt: null,
        expiresAt: { gt: now },
      });
    });

    it('un código ya usado no se acepta otra vez (gana una sola validación)', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(stored());
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.verify(phone, '123456', now)).resolves.toBe(false);
    });

    it('código incorrecto: suma un intento y al quinto lo invalida', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(stored());
      await expect(service.verify(phone, '000000', now)).resolves.toBe(false);
      expect(prisma.otpCode.updateMany.mock.calls[0][0].data).toEqual({
        attempts: { increment: 1 },
      });

      prisma.otpCode.findFirst.mockResolvedValue(stored({ attempts: 4 }));
      await service.verify(phone, '000000', now);
      expect(prisma.otpCode.updateMany.mock.calls[1][0].data).toEqual({
        attempts: { increment: 1 },
        expiresAt: now,
      });

      // Con los 5 intentos agotados ni el código correcto sirve.
      prisma.otpCode.findFirst.mockResolvedValue(stored({ attempts: 5 }));
      await expect(service.verify(phone, '123456', now)).resolves.toBe(false);
    });

    it('vencido o inexistente: falla', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);
      await expect(service.verify(phone, '123456', now)).resolves.toBe(false);
      expect(prisma.otpCode.updateMany).not.toHaveBeenCalled();
    });
  });

  it('la prueba de verificación sirve para ese celular y no para otro', async () => {
    const token = await service.issueVerificationToken(phone);
    await expect(
      service.confirm(phone, { verificationToken: token }),
    ).resolves.toBe(true);
    await expect(
      service.confirm('+573009999999', { verificationToken: token }),
    ).resolves.toBe(false);
    // No es un token de sesión: no lo acepta el secreto de las sesiones.
    await expect(
      new JwtService({ secret: 'x'.repeat(32) }).verifyAsync(token),
    ).rejects.toThrow();
  });
});

describe('otpSecret', () => {
  it('sin OTP_SECRET deriva uno distinto del de las sesiones', async () => {
    const { otpSecret } = await import('./otp.module.js');
    const { ConfigService } = await import('@nestjs/config');
    const jwtSecret = 'j'.repeat(32);
    const derived = otpSecret(new ConfigService({ JWT_SECRET: jwtSecret }));
    expect(derived).not.toBe(jwtSecret);
    expect(derived).toHaveLength(64);
    expect(
      otpSecret(
        new ConfigService({
          JWT_SECRET: jwtSecret,
          OTP_SECRET: 'o'.repeat(32),
        }),
      ),
    ).toBe('o'.repeat(32));
  });
});
