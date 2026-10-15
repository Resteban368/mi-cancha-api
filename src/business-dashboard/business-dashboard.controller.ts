import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessDashboardService } from './business-dashboard.service.js';
import {
  BusinessDashboardDto,
  BusinessDashboardQueryDto,
} from './dto/business-dashboard.dto.js';

const SUMMARY =
  'Métricas del negocio en un período: reservas, ingresos, ocupación, días y horas con más movimiento, top 5 clientes, métodos de pago y deportes';

@ApiTags('business / dashboard')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/dashboard')
export class BusinessDashboardController {
  constructor(
    private readonly dashboard: BusinessDashboardService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get()
  @ApiOperation({ summary: SUMMARY })
  async get(
    @CurrentUser() user: AuthPayload,
    @Query() query: BusinessDashboardQueryDto,
  ): Promise<BusinessDashboardDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.dashboard.getDashboard(businessId, query);
  }
}

/** El mismo dashboard para el super admin, por cliente. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/clients')
export class AdminBusinessDashboardController {
  constructor(
    private readonly dashboard: BusinessDashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/dashboard')
  @ApiOperation({ summary: SUMMARY })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: BusinessDashboardQueryDto,
  ): Promise<BusinessDashboardDto> {
    if (!(await this.prisma.business.count({ where: { id } }))) {
      throw new NotFoundException('El cliente no existe');
    }
    return this.dashboard.getDashboard(id, query);
  }
}
