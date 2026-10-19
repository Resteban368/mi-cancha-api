import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUDIT_ACTIONS } from '../audit/audit-actions.js';
import {
  AuditActionDto,
  AuditPageDto,
  AuditQueryDto,
} from '../audit/dto/audit.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { OtpStatsDto, OtpStatsQueryDto } from './dto/otp-stats.dto.js';
import { OtpStatsService } from './otp-stats.service.js';

@ApiTags('admin / seguridad')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/security')
export class SecurityController {
  constructor(
    private readonly otpStats: OtpStatsService,
    private readonly audit: AuditService,
  ) {}

  @Get('otp')
  @ApiOperation({
    summary:
      'Códigos SMS enviados: totales, por día y quién los pide más (por celular y por origen)',
  })
  otp(@Query() query: OtpStatsQueryDto): Promise<OtpStatsDto> {
    return this.otpStats.stats(query.days);
  }

  @Get('audit')
  @ApiOperation({
    summary:
      'Auditoría: acciones del super admin y eventos de seguridad, del más reciente al más antiguo',
  })
  auditLog(@Query() query: AuditQueryDto): Promise<AuditPageDto> {
    return this.audit.list(query);
  }

  @Get('audit/actions')
  @ApiOperation({
    summary: 'Acciones que se registran, con su categoría y etiqueta (para filtros)',
  })
  auditActions(): AuditActionDto[] {
    return AUDIT_ACTIONS;
  }
}
