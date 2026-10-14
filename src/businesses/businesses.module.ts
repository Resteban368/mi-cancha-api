import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';

@Module({
  imports: [CatalogsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
