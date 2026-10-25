import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service.js';
import { CatalogsDto } from './dto/catalog.dto.js';
import { CityDto, DepartmentDto } from './dto/location.dto.js';

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Servicios, métodos de pago y superficies de cancha activos (para la app)',
  })
  findActive(): Promise<CatalogsDto> {
    return this.catalogsService.findActive();
  }

  @Get('departments')
  @ApiOperation({ summary: 'Departamentos de Colombia (DANE)' })
  departments(): Promise<DepartmentDto[]> {
    return this.catalogsService.departments();
  }

  @Get('departments/:id/cities')
  @ApiOperation({ summary: 'Ciudades (municipios) de un departamento' })
  cities(@Param('id', ParseUUIDPipe) id: string): Promise<CityDto[]> {
    return this.catalogsService.cities(id);
  }
}
