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
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  CreateProductDto,
  CreateSaleDto,
  ProductDto,
  ProductsQueryDto,
  SaleDto,
  SalesQueryDto,
  UpdateProductDto,
  VoidSaleDto,
} from './dto/sale.dto.js';
import { SalesService } from './sales.service.js';

@ApiTags('business / products')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/products')
export class ProductsController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({
    summary: 'Productos del negocio, por nombre (activos o todos)',
  })
  findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: ProductsQueryDto,
  ): Promise<ProductDto[]> {
    return this.salesService.listProducts(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un producto' })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.salesService.createProduct(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar nombre, precio o activar/desactivar un producto',
  })
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.salesService.updateProduct(user.sub, id, dto);
  }
}

@ApiTags('business / sales')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({
    summary: 'Ventas de un día o de una reserva (más recientes primero)',
  })
  findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: SalesQueryDto,
  ): Promise<SaleDto[]> {
    return this.salesService.listSales(user.sub, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Registrar una venta: consumo de una reserva (suma a su saldo) o venta suelta pagada',
  })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleDto> {
    return this.salesService.createSale(user.sub, dto, user.sub);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Anular una venta (con motivo)' })
  void(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidSaleDto,
  ): Promise<SaleDto> {
    return this.salesService.voidSale(user.sub, id, dto);
  }
}
