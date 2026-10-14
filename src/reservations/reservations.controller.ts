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
  AvailabilityDto,
  AvailabilityQueryDto,
  CancelReservationDto,
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
  @ApiOperation({
    summary:
      'Reservar turnos seguidos con cliente (existente o nuevo), descuento y pago opcional',
  })
  create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    return this.reservationsService.create(user.sub, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      'Cancelar una reserva confirmada con su motivo (libera el turno y devuelve los pagos)',
  })
  cancel(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
  ): Promise<ReservationDto> {
    return this.reservationsService.cancel(user.sub, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Marcar como confirmada, jugada (COMPLETED) o no asistió (NO_SHOW)',
  })
  updateStatus(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationStatusDto,
  ): Promise<ReservationDto> {
    return this.reservationsService.updateStatus(user.sub, id, dto);
  }
}

@ApiTags('business / reservations')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/courts')
export class CourtAvailabilityController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get(':id/availability')
  @ApiOperation({
    summary:
      'Turnos de un día con su estado (AVAILABLE, BOOKED, PAST) y precio',
  })
  availability(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityDto> {
    return this.reservationsService.availabilityForOwner(
      user.sub,
      id,
      query.date,
    );
  }
}
