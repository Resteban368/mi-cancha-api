import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipAudit } from '../audit/audit-skip.decorator.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PageQueryDto } from '../common/dto/page.dto.js';
import { clientIp } from '../otp/client-ip.js';
import {
  BroadcastDto,
  BroadcastRecipientDto,
  BroadcastResultDto,
} from './dto/broadcast.dto.js';
import { BroadcastHistoryPageDto } from './dto/inbox.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('admin / notificaciones')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('recipients')
  @ApiOperation({
    summary: 'Negocios y cuántos navegadores tienen con los avisos activados',
  })
  recipients(): Promise<BroadcastRecipientDto[]> {
    return this.notifications.recipients();
  }

  @Get('broadcasts')
  @ApiOperation({
    summary: 'Historial de avisos enviados, con a cuántos llegó y cuántos lo leyeron',
  })
  broadcasts(@Query() query: PageQueryDto): Promise<BroadcastHistoryPageDto> {
    return this.notifications.broadcasts(query);
  }

  // Registra su propio evento de auditoría, con el alcance y cuántos lo recibieron.
  @SkipAudit()
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar un aviso a todos los negocios o solo a los elegidos',
  })
  broadcast(
    @CurrentUser() admin: AuthPayload,
    @Body() dto: BroadcastDto,
    @Req() req: Request,
  ): Promise<BroadcastResultDto> {
    return this.notifications.broadcast(admin.sub, dto, clientIp(req));
  }
}
