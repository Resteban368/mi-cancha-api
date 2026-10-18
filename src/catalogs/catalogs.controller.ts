import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service.js';
import { CatalogsDto } from './dto/catalog.dto.js';

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Servicios, métodos de pago y superficies de cancha activos (para la app)',
  })
  findActive(): Promise<CatalogsDto> {
    return this.catalogsService.findActive();
  }
}
