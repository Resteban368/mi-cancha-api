import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import type { Page } from '../common/dto/page.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  InventoryDto,
  StockAdjustmentDto,
  StockEntryDto,
  StockMovementDto,
  StockMovementsQueryDto,
} from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('business / inventory')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Existencias de los productos y alertas' })
  overview(@CurrentUser() user: AuthPayload): Promise<InventoryDto> {
    return this.inventoryService.overview(user.sub);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Entrada de mercancía (suma al stock)' })
  addEntry(
    @CurrentUser() user: AuthPayload,
    @Body() dto: StockEntryDto,
  ): Promise<StockMovementDto> {
    return this.inventoryService.addEntry(user.sub, dto);
  }

  @Post('adjustments')
  @ApiOperation({
    summary: 'Ajuste por conteo físico (deja el stock en ese valor)',
  })
  adjust(
    @CurrentUser() user: AuthPayload,
    @Body() dto: StockAdjustmentDto,
  ): Promise<StockMovementDto> {
    return this.inventoryService.adjust(user.sub, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Historial de existencias (más recientes primero)' })
  movements(
    @CurrentUser() user: AuthPayload,
    @Query() query: StockMovementsQueryDto,
  ): Promise<Page<StockMovementDto>> {
    return this.inventoryService.movements(user.sub, query);
  }
}
