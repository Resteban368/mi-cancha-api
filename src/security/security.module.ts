import { Module } from '@nestjs/common';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { OtpStatsService } from './otp-stats.service.js';
import { SecurityController } from './security.controller.js';
import { UserBanController } from './user-ban.controller.js';
import { UserBanService } from './user-ban.service.js';

/** Seguridad de la plataforma para el super admin: códigos SMS, auditoría y bloqueos. */
@Module({
  imports: [ReservationsModule],
  controllers: [SecurityController, UserBanController],
  providers: [OtpStatsService, UserBanService],
})
export class SecurityModule {}
