import { Module } from '@nestjs/common';
import { CourtsModule } from '../courts/courts.module.js';
import { AdminController } from './admin.controller.js';
import { ClientsService } from './clients.service.js';
import { DashboardService } from './dashboard.service.js';
import { PlansService } from './plans.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [CourtsModule],
  controllers: [AdminController],
  providers: [DashboardService, ClientsService, UsersService, PlansService],
})
export class AdminModule {}
