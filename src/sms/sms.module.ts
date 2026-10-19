import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DevSmsService,
  SmsService,
  TwilioSmsService,
  UnconfiguredSmsService,
} from './sms.service.js';

/**
 * SMS con Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).
 * Sin credenciales: en desarrollo no envía nada; en producción responde 503.
 */
@Module({
  providers: [
    {
      provide: SmsService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsService => {
        const accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = config.get<string>('TWILIO_AUTH_TOKEN');
        const from = config.get<string>('TWILIO_FROM_NUMBER');
        if (accountSid && authToken && from) {
          return new TwilioSmsService({ accountSid, authToken, from });
        }
        if (config.get<string>('NODE_ENV') === 'production') {
          new Logger('SmsModule').error(
            'Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_FROM_NUMBER: no se enviarán SMS',
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
