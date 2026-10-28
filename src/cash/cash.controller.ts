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
import type { Page } from '../common/dto/page.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CashService } from './cash.service.js';
import {
  CashCurrentDto,
  CashExpenseDto,
  CashSessionDto,
  CashSessionsQueryDto,
  CloseCashDto,
  CreateCashExpenseDto,
  CreateSupplierDto,
  OpenCashDto,
  SupplierDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
  VoidCashExpenseDto,
} from './dto/cash.dto.js';

@ApiTags('business / cash')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Caja abierta con lo cobrado hasta ahora y el último cierre',
  })
  current(@CurrentUser() user: AuthPayload): Promise<CashCurrentDto> {
    return this.cashService.current(user.sub);
  }

  @Post('open')
  @ApiOperation({ summary: 'Abrir la caja con una base de efectivo' })
  open(
    @CurrentUser() user: AuthPayload,
    @Body() dto: OpenCashDto,
  ): Promise<CashSessionDto> {
    return this.cashService.open(user.sub, dto);
  }

  @Post('close')
  @ApiOperation({ summary: 'Cerrar la caja con el efectivo contado (arqueo)' })
  close(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CloseCashDto,
  ): Promise<CashSessionDto> {
    return this.cashService.close(user.sub, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Cierres anteriores (más recientes primero)' })
  history(
    @CurrentUser() user: AuthPayload,
    @Query() query: CashSessionsQueryDto,
  ): Promise<Page<CashSessionDto>> {
    return this.cashService.history(user.sub, query);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Pago a un proveedor en la caja abierta' })
  addExpense(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateCashExpenseDto,
  ): Promise<CashExpenseDto> {
    return this.cashService.addExpense(user.sub, dto);
  }

  @Post('expenses/:id/void')
  @ApiOperation({ summary: 'Anular un pago a proveedor (caja abierta)' })
  voidExpense(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidCashExpenseDto,
  ): Promise<CashExpenseDto> {
    return this.cashService.voidExpense(user.sub, id, dto);
  }
}

@ApiTags('business / suppliers')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/suppliers')
export class SuppliersController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  @ApiOperation({ summary: 'Proveedores del negocio (activos o todos)' })
  findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: SuppliersQueryDto,
  ): Promise<SupplierDto[]> {
    return this.cashService.listSuppliers(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un proveedor' })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierDto> {
    return this.cashService.createSupplier(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o activar/desactivar un proveedor' })
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    return this.cashService.updateSupplier(user.sub, id, dto);
  }
}
