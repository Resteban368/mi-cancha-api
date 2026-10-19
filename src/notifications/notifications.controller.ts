import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  SubscribeDto,
  UnsubscribeDto,
  VapidKeyDto,
} from './dto/subscription.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('business / notifications')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('vapid-key')
  @ApiOperation({
    summary:
      'Clave pública VAPID para suscribir el navegador (404 si el servidor no tiene push configurado)',
  })
  vapidKey(): VapidKeyDto {
    const publicKey = this.notifications.publicKey;
    if (!publicKey) throw new NotFoundException('Las notificaciones no están disponibles');
    return { publicKey };
  }

  @Post('subscriptions')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Suscribir este navegador a los avisos de nuevas reservas',
  })
  subscribe(
    @CurrentUser() user: AuthPayload,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    return this.notifications.subscribe(user.sub, dto, userAgent);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar la suscripción de este navegador' })
  unsubscribe(
    @CurrentUser() user: AuthPayload,
    @Body() dto: UnsubscribeDto,
  ): Promise<void> {
    return this.notifications.unsubscribe(user.sub, dto.endpoint);
  }
}
