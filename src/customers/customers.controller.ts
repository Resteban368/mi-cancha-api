import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CustomersService } from './customers.service.js';
import { CustomerDto, CustomerSearchDto } from './dto/customer.dto.js';

@ApiTags('business / customers')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Buscar clientes del negocio por nombre, teléfono o cédula (máx. 20)',
  })
  async search(
    @CurrentUser() user: AuthPayload,
    @Query() query: CustomerSearchDto,
  ): Promise<CustomerDto[]> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.customersService.search(businessId, query.search);
  }
}
