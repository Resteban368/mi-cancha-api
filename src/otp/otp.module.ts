import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsModule } from '../sms/sms.module.js';
import { DevSmsService, SmsService } from '../sms/sms.service.js';
import { OtpController } from './otp.controller.js';
import { OtpService } from './otp.service.js';

/**
 * OTP_SECRET, o uno derivado de JWT_SECRET: nunca el mismo de las sesiones,
 * para que la prueba de verificación no sirva como token de sesión.
 */
export function otpSecret(config: ConfigService): string {
  return (
    config.get<string>('OTP_SECRET') ??
    createHmac('sha256', config.getOrThrow<string>('JWT_SECRET'))
      .update('mi-cancha:otp')
      .digest('hex')
  );
}

/** Código fijo en desarrollo sin Twilio (nunca en producción). */
export const DEV_OTP_CODE = '123456';

@Module({
  imports: [SmsModule],
  controllers: [OtpController],
  providers: [
    {
      provide: OtpService,
      inject: [PrismaService, SmsService, JwtService, ConfigService],
      useFactory: (
        prisma: PrismaService,
        sms: SmsService,
        jwt: JwtService,
        config: ConfigService,
      ) =>
        new OtpService(prisma, sms, jwt, {
          secret: otpSecret(config),
          fixedCode:
            sms instanceof DevSmsService &&
            config.get<string>('NODE_ENV') !== 'production'
              ? DEV_OTP_CODE
              : null,
        }),
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
