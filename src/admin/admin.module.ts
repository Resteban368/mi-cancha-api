import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { ClientsService } from './clients.service.js';
import { DashboardService } from './dashboard.service.js';
import { PlansService } from './plans.service.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [AdminController],
  providers: [DashboardService, ClientsService, UsersService, PlansService],
})
export class AdminModule {}
