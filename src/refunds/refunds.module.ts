import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
