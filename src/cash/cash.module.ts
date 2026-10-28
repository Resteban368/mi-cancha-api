import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CashController } from './cash.controller.js';
import { CashService } from './cash.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
