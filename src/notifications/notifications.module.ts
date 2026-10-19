import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsController } from './admin-notifications.controller.js';
import { PublicNotificationsController } from './public-notifications.controller.js';
import { NotificationImagesController } from './notification-images.controller.js';
import { NotificationImagesService } from './notification-images.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import {
  DevPushService,
  PushService,
  UnconfiguredPushService,
  WebPushService,
} from './push.service.js';

/**
 * Web Push (VAPID): VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (se generan con
 * `npx web-push generate-vapid-keys`) y VAPID_SUBJECT (mailto: de contacto).
 * Sin claves: en desarrollo solo registra en el log; en producción lo deja
 * como error y no envía.
 */
@Module({
  controllers: [
    NotificationsController,
    AdminNotificationsController,
    PublicNotificationsController,
    NotificationImagesController,
  ],
  providers: [
    NotificationsService,
    NotificationImagesService,
    {
      provide: PushService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushService => {
        const publicKey = config.get<string>('VAPID_PUBLIC_KEY')?.trim();
        const privateKey = config.get<string>('VAPID_PRIVATE_KEY')?.trim();
        if (publicKey && privateKey) {
          return new WebPushService({
            publicKey,
            privateKey,
            subject:
              config.get<string>('VAPID_SUBJECT')?.trim() ||
              'mailto:soporte@micancha.app',
          });
        }
        return config.get<string>('NODE_ENV') === 'production'
          ? new UnconfiguredPushService()
          : new DevPushService();
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
