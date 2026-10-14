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
  CreateReservationDto,
  DayQueryDto,
  ReservationDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto.js';
import { ReservationsService } from './reservations.service.js';

@ApiTags('business / reservations')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Agenda de un día (todas las canchas)' })
  findForDay(
    @CurrentUser() user: AuthPayload,
    @Query() query: DayQueryDto,
  ): Promise<ReservationDto[]> {
    return this.reservationsService.findForDay(user.sub, query.date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una reserva' })
  findOne(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationDto> {
    return this.reservationsService.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una reserva (valida cruces de horario)' })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    return this.reservationsService.create(user.sub, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar el estado (completada, no-show, cancelada…)',
  })
  updateStatus(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationStatusDto,
  ): Promise<ReservationDto> {
    return this.reservationsService.updateStatus(user.sub, id, dto);
  }
}
