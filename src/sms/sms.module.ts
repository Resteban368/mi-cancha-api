import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DevSmsService,
  SmsService,
  TwilioSmsService,
  UnconfiguredSmsService,
} from './sms.service.js';

/**
 * SMS con Twilio: TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER y una API Key
 * (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) o el TWILIO_AUTH_TOKEN.
 * Sin credenciales: en desarrollo no envía nada; en producción responde 503.
 */
@Module({
  providers: [
    {
      provide: SmsService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsService => {
        const accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
        const keySid = config.get<string>('TWILIO_API_KEY_SID');
        const keySecret = config.get<string>('TWILIO_API_KEY_SECRET');
        const authToken = config.get<string>('TWILIO_AUTH_TOKEN');
        const from = config.get<string>('TWILIO_FROM_NUMBER');
        // API Key (recomendado: se revoca sin tocar la cuenta) o Auth Token.
        const apiKey =
          keySid && keySecret ? { sid: keySid, secret: keySecret } : undefined;
        if (accountSid && from && (apiKey || authToken)) {
          return new TwilioSmsService({ accountSid, apiKey, authToken, from });
        }
        if (config.get<string>('NODE_ENV') === 'production') {
          new Logger('SmsModule').error(
            'Faltan TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER o las credenciales (API Key o Auth Token): no se enviarán SMS',
          );
          return new UnconfiguredSmsService();
        }
        return new DevSmsService();
      },
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
