import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { CourtPhotosController } from './court-photos.controller.js';
import { CourtPhotosService } from './court-photos.service.js';
import { CourtsController } from './courts.controller.js';
import { CourtsService } from './courts.service.js';

@Module({
  imports: [BusinessesModule, CatalogsModule],
  controllers: [CourtsController, CourtPhotosController],
  providers: [CourtsService, CourtPhotosService],
  exports: [CourtsService, CourtPhotosService],
})
export class CourtsModule {}
