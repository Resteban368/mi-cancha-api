import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, sep } from 'node:path';
import { AccountModule } from './account/account.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CatalogsModule } from './catalogs/catalogs.module.js';
import { validateEnv } from './config/env.validation.js';
import { CourtsModule } from './courts/courts.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { HealthController } from './health/health.controller.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Panel de super admin (npm run build:admin → public/admin), servido en /admin.
    // En Vercel los archivos tienen la fecha fija, así que el ETag de index.html no
    // cambia entre despliegues y el navegador se quedaría con uno viejo (304) que
    // apunta a un JS que ya no existe. Por eso lo que no está en assets/ va con
    // no-store; los de assets/ llevan hash en el nombre y se guardan para siempre.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'admin'),
      serveRoot: '/admin',
      serveStaticOptions: {
        etag: false,
        lastModified: false,
        setHeaders: (res, path) => {
          res.setHeader(
            'Cache-Control',
            path.includes(`${sep}assets${sep}`)
              ? 'public, max-age=31536000, immutable'
              : 'no-store',
          );
        },
      },
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    BusinessesModule,
    CourtsModule,
    ReservationsModule,
    CustomersModule,
    RefundsModule,
    PaymentsModule,
    AccountModule,
    CatalogsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
