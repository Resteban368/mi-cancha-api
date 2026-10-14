import { Module } from '@nestjs/common';
import { AdminCatalogsController } from './admin-catalogs.controller.js';
import { CatalogsController } from './catalogs.controller.js';
import { CatalogsService } from './catalogs.service.js';

@Module({
  controllers: [CatalogsController, AdminCatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
