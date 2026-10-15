import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CustomersService } from './customers.service.js';
import {
  CreateCustomerDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerPageDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto.js';

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
      'Clientes: con page, la cartera paginada con métricas, resumen, filtros (segment) y orden (sort); sin page, búsqueda rápida (máx. 20)',
  })
  async list(
    @CurrentUser() user: AuthPayload,
    @Query() query: CustomerQueryDto,
  ): Promise<CustomerDto[] | CustomerPageDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    if (query.page !== undefined) {
      return this.customersService.findPaginated(businessId, query);
    }
    return this.customersService.search(businessId, query.search);
  }

  @Get(':customerId')
  @ApiOperation({
    summary: 'Ficha del cliente con sus reservas y pagos en detalle',
  })
  async findOne(
    @CurrentUser() user: AuthPayload,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<CustomerDetailDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.customersService.findOneDetail(businessId, customerId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un cliente sin reserva' })
  async create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.customersService.create(businessId, dto);
  }

  @Patch(':customerId')
  @ApiOperation({
    summary:
      'Editar nombre, teléfono, cédula, deporte habitual o notas (el nivel es automático)',
  })
  async update(
    @CurrentUser() user: AuthPayload,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    const businessId = await this.businesses.requireBusinessId(user.sub);
    return this.customersService.update(businessId, customerId, dto);
  }
}
