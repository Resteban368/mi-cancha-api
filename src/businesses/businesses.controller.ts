import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { BusinessesService } from './businesses.service.js';
import { BusinessDto, SaveBusinessDto } from './dto/business.dto.js';

@ApiTags('business / profile')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/profile')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'Perfil del negocio (404 si aún no existe)' })
  findMine(@CurrentUser() user: AuthPayload): Promise<BusinessDto> {
    return this.businessesService.findMine(user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Crear o actualizar el perfil del negocio' })
  save(
    @CurrentUser() user: AuthPayload,
    @Body() dto: SaveBusinessDto,
  ): Promise<BusinessDto> {
    return this.businessesService.save(user.sub, dto);
  }
}
