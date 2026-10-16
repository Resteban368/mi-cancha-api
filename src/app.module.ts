import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join, sep } from 'node:path';
import { AccountModule } from './account/account.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessDashboardModule } from './business-dashboard/business-dashboard.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CatalogsModule } from './catalogs/catalogs.module.js';
import { DEFAULT_RATE_LIMIT } from './common/rate-limit.js';
import { validateEnv } from './config/env.validation.js';
import { CourtsModule } from './courts/courts.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { HealthController } from './health/health.controller.js';
import { OnlineBookingModule } from './online-booking/online-booking.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Límite de peticiones por IP (los de login y registro son más estrictos, ver
    // common/rate-limit.ts). Los contadores viven en la memoria de cada instancia:
    // en Vercel cada instancia cuenta por separado, así que el límite real puede
    // ser algo mayor. Para un límite exacto, usar un almacenamiento compartido (Redis).
    ThrottlerModule.forRoot({ throttlers: [DEFAULT_RATE_LIMIT] }),
    // Panel de super admin (public/admin → /admin) y web de reservas para
    // jugadores (public/reservar → /reservar), compilados con Vite.
    // En Vercel los archivos tienen la fecha fija, así que el ETag de index.html no
    // cambia entre despliegues y el navegador se quedaría con uno viejo (304) que
    // apunta a un JS que ya no existe. Por eso lo que no está en assets/ va con
    // no-store; los de assets/ llevan hash en el nombre y se guardan para siempre.
    ServeStaticModule.forRoot(
      ...['admin', 'reservar'].map((app) => ({
        rootPath: join(process.cwd(), 'public', app),
        serveRoot: `/${app}`,
        serveStaticOptions: {
          etag: false,
          lastModified: false,
          setHeaders: (
            res: { setHeader: (k: string, v: string) => void },
            path: string,
          ) => {
            res.setHeader(
              'Cache-Control',
              path.includes(`${sep}assets${sep}`)
                ? 'public, max-age=31536000, immutable'
                : 'no-store',
            );
          },
        },
      })),
    ),
    PrismaModule,
    StorageModule,
    AuthModule,
    BusinessesModule,
    CourtsModule,
    ReservationsModule,
    CustomersModule,
    RefundsModule,
    BusinessDashboardModule,
    OnlineBookingModule,
    PaymentsModule,
    AccountModule,
    CatalogsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
