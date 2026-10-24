import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { BusinessImagesService } from './business-images.service.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { ImagesController } from './images.controller.js';

@Module({
  imports: [CatalogsModule],
  controllers: [BusinessesController, ImagesController],
  providers: [BusinessesService, BusinessImagesService],
  exports: [BusinessesService, BusinessImagesService],
})
export class BusinessesModule {}
