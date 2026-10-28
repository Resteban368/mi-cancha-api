import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { ProductsController, SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  imports: [BusinessesModule, CatalogsModule],
  controllers: [ProductsController, SalesController],
  providers: [SalesService],
})
export class SalesModule {}
