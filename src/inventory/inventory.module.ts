import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
