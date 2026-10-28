import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { CashController, SuppliersController } from './cash.controller.js';
import { CashService } from './cash.service.js';

@Module({
  imports: [BusinessesModule, CatalogsModule],
  controllers: [CashController, SuppliersController],
  providers: [CashService],
})
export class CashModule {}
