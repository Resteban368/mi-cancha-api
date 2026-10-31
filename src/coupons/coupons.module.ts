import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import {
  CouponsController,
  PlayerCouponsController,
  PublicCouponsController,
} from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [
    CouponsController,
    PlayerCouponsController,
    PublicCouponsController,
  ],
  providers: [CouponsService],
})
export class CouponsModule {}
