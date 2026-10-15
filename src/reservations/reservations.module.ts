import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  CourtAvailabilityController,
  ReservationsController,
  SportAvailabilityController,
} from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [BusinessesModule, CustomersModule, CatalogsModule],
  controllers: [
    ReservationsController,
    CourtAvailabilityController,
    SportAvailabilityController,
  ],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
