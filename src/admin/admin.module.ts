import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CourtsModule } from '../courts/courts.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { AdminController } from './admin.controller.js';
import { ClientsService } from './clients.service.js';
import { DashboardService } from './dashboard.service.js';
import { PlansService } from './plans.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    BusinessesModule,
    CourtsModule,
    ReservationsModule,
    CustomersModule,
    RefundsModule,
  ],
  controllers: [AdminController],
  providers: [DashboardService, ClientsService, UsersService, PlansService],
})
export class AdminModule {}
