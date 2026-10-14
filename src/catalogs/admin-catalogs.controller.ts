import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CatalogsService } from './catalogs.service.js';
import {
  AdminAmenityDto,
  AdminPaymentMethodDto,
  AmenityDto,
  CreateAmenityDto,
  CreatePaymentMethodDto,
  PaymentMethodDto,
  UpdateAmenityDto,
  UpdatePaymentMethodDto,
} from './dto/catalog.dto.js';

@ApiTags('admin / catalogs')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/catalogs')
export class AdminCatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('amenities')
  @ApiOperation({ summary: 'Servicios (incluye inactivos y uso)' })
  findAmenities(): Promise<AdminAmenityDto[]> {
    return this.catalogsService.findAllAmenities();
  }

  @Post('amenities')
  @ApiOperation({ summary: 'Crear un servicio' })
  createAmenity(@Body() dto: CreateAmenityDto): Promise<AmenityDto> {
    return this.catalogsService.createAmenity(dto);
  }

  @Patch('amenities/:id')
  @ApiOperation({ summary: 'Editar o (des)activar un servicio' })
  updateAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmenityDto,
  ): Promise<AmenityDto> {
    return this.catalogsService.updateAmenity(id, dto);
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Métodos de pago (incluye inactivos y uso)' })
  findPaymentMethods(): Promise<AdminPaymentMethodDto[]> {
    return this.catalogsService.findAllPaymentMethods();
  }

  @Post('payment-methods')
  @ApiOperation({ summary: 'Crear un método de pago' })
  createPaymentMethod(
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    return this.catalogsService.createPaymentMethod(dto);
  }

  @Patch('payment-methods/:id')
  @ApiOperation({ summary: 'Editar o (des)activar un método de pago' })
  updatePaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    return this.catalogsService.updatePaymentMethod(id, dto);
  }
}
