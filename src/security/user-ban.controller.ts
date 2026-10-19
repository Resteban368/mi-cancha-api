import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipAudit } from '../audit/audit-skip.decorator.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { clientIp } from '../otp/client-ip.js';
import { BanPreviewDto, BanResultDto, BanUserDto } from './dto/ban.dto.js';
import { UserBanService } from './user-ban.service.js';

@ApiTags('admin / seguridad')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/users')
export class UserBanController {
  constructor(private readonly bans: UserBanService) {}

  @Get(':id/ban-preview')
  @ApiOperation({
    summary:
      'Antes de bloquear: a quién y cuántas reservas futuras se cancelarían',
  })
  preview(@Param('id', ParseUUIDPipe) id: string): Promise<BanPreviewDto> {
    return this.bans.preview(id);
  }

  // Estos dos registran su propio evento de auditoría, con el motivo y el resultado.
  @SkipAudit()
  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bloquear una cuenta (jugador o negocio): no puede ingresar y sus sesiones dejan de valer',
  })
  ban(
    @CurrentUser() admin: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ): Promise<BanResultDto> {
    return this.bans.ban(admin.sub, id, dto, clientIp(req));
  }

  @SkipAudit()
  @Delete(':id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desbloquear una cuenta' })
  unban(
    @CurrentUser() admin: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.bans.unban(admin.sub, id, clientIp(req));
  }
}
