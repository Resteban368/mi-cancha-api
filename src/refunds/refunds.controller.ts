import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { RefundDto, RefundsService } from './refunds.service.js';

@ApiTags('business / refunds')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/refunds')
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Devoluciones del negocio (más recientes primero)' })
  async findAll(@CurrentUser() user: AuthPayload): Promise<RefundDto[]> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.refundsService.listForBusiness(businessId);
  }
}
