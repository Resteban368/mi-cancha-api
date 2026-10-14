import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CourtsService } from './courts.service.js';
import { CourtDto, CreateCourtDto, UpdateCourtDto } from './dto/court.dto.js';

@ApiTags('business / courts')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las canchas del negocio' })
  findAll(@CurrentUser() user: AuthPayload): Promise<CourtDto[]> {
    return this.courtsService.findAll(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una cancha (respeta el límite del plan)' })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateCourtDto,
  ): Promise<CourtDto> {
    return this.courtsService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar o reactivar una cancha' })
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    return this.courtsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una cancha' })
  deactivate(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourtDto> {
    return this.courtsService.deactivate(user.sub, id);
  }
}
