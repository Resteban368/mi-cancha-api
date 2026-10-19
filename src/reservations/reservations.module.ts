import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  CourtAvailabilityController,
  ReservationsController,
  SportAvailabilityController,
} from './reservations.controller.js';
import { PlayerHistoryService } from './player-history.service.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [
    BusinessesModule,
    CustomersModule,
    CatalogsModule,
    NotificationsModule,
  ],
  controllers: [
    ReservationsController,
    CourtAvailabilityController,
    SportAvailabilityController,
  ],
  providers: [ReservationsService, PlayerHistoryService],
  exports: [ReservationsService, PlayerHistoryService],
})
export class ReservationsModule {}
