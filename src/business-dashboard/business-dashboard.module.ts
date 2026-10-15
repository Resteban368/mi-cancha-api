import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import {
  AdminBusinessDashboardController,
  BusinessDashboardController,
} from './business-dashboard.controller.js';
import { BusinessDashboardService } from './business-dashboard.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [BusinessDashboardController, AdminBusinessDashboardController],
  providers: [BusinessDashboardService],
})
export class BusinessDashboardModule {}
