import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AccountModule } from './account/account.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CatalogsModule } from './catalogs/catalogs.module.js';
import { validateEnv } from './config/env.validation.js';
import { CourtsModule } from './courts/courts.module.js';
import { HealthController } from './health/health.controller.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Panel de super admin (admin/ → npm run build:admin), servido en /admin.
    ServeStaticModule.forRoot({
      rootPath: join(import.meta.dirname, '..', 'admin', 'dist'),
      serveRoot: '/admin',
    }),
    PrismaModule,
    AuthModule,
    BusinessesModule,
    CourtsModule,
    ReservationsModule,
    PaymentsModule,
    AccountModule,
    CatalogsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
