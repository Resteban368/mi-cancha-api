import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
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
  InboxPageDto,
  InboxQueryDto,
  UnreadCountDto,
} from './dto/inbox.dto.js';
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

  @Get()
  @ApiOperation({
    summary:
      'Bandeja del negocio: sus notificaciones (reservas nuevas y avisos), de la más reciente a la más antigua',
  })
  list(
    @CurrentUser() user: AuthPayload,
    @Query() query: InboxQueryDto,
  ): Promise<InboxPageDto> {
    return this.notifications.inbox(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cuántas notificaciones no ha leído (para la insignia)' })
  async unreadCount(@CurrentUser() user: AuthPayload): Promise<UnreadCountDto> {
    return { unread: await this.notifications.unreadCount(user.sub) };
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  readAll(@CurrentUser() user: AuthPayload): Promise<void> {
    return this.notifications.markAllRead(user.sub);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  read(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(user.sub, id);
  }

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
