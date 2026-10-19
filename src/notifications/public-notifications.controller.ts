import { Body, Controller, Delete, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator.js';
import { UnsubscribeDto } from './dto/subscription.dto.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Corte de avisos al cerrar sesión sin depender del token: si la sesión ya
 * venció, el DELETE autenticado respondería 401 y el navegador seguiría
 * recibiendo avisos. La URL del endpoint es un secreto único de ese navegador
 * (solo la conoce el propio navegador y este servidor), así que basta con ella.
 */
@ApiTags('public / notifications')
@Public()
@Controller('public/notifications')
export class PublicNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Delete('subscriptions')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Quitar la suscripción de este navegador sin sesión (cierre de sesión o sesión vencida)',
  })
  unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    return this.notifications.forgetEndpoint(dto.endpoint);
  }
}
