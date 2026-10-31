import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CouponImagesService } from './coupon-images.service.js';
import {
  CouponImagesController,
  CouponsController,
  PlayerCouponsController,
  PublicCouponsController,
} from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [
    CouponImagesController,
    CouponsController,
    PlayerCouponsController,
    PublicCouponsController,
  ],
  providers: [CouponsService, CouponImagesService],
})
export class CouponsModule {}
