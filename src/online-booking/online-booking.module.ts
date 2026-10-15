import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import {
  AdminOnlineBookingController,
  BusinessOnlineBookingController,
  PlayerController,
  PublicBookingController,
} from './online-booking.controller.js';
import { OnlineBookingService } from './online-booking.service.js';
import { PlayerAuthService } from './player-auth.service.js';

@Module({
  imports: [BusinessesModule, ReservationsModule],
  controllers: [
    PublicBookingController,
    PlayerController,
    BusinessOnlineBookingController,
    AdminOnlineBookingController,
  ],
  providers: [OnlineBookingService, PlayerAuthService],
})
export class OnlineBookingModule {}
