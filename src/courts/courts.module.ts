import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CourtsController } from './courts.controller.js';
import { CourtsService } from './courts.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [CourtsController],
  providers: [CourtsService],
})
export class CourtsModule {}
