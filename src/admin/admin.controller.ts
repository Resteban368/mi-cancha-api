import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { PageQueryDto } from '../common/dto/page.dto.js';
import {
  CourtPhotoSlot,
  DayOfWeek,
  PaymentConcept,
  PaymentStatus,
  ReservationStatus,
  Sport,
  UserRole,
} from '../generated/prisma/enums.js';
import { CourtsService } from '../courts/courts.service.js';
import { CourtDto, UpdateCourtDto } from '../courts/dto/court.dto.js';
import { CustomersService } from '../customers/customers.service.js';
import {
  CustomerDto,
  CustomerSearchDto,
} from '../customers/dto/customer.dto.js';
import { RefundDto, RefundsService } from '../refunds/refunds.service.js';
import {
  AvailabilityDto,
  AvailabilityQueryDto,
  CancelReservationDto,
  CreateReservationDto,
  DayQueryDto,
  ReservationDto,
} from '../reservations/dto/reservation.dto.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import { ClientsService } from './clients.service.js';
import { DashboardService } from './dashboard.service.js';
import {
  ClientDetailDto,
  ClientDto,
  ClientPageDto,
  CreateClientDto,
  CreatePlanDto,
  DashboardDto,
  PlanDto,
  SystemEnumDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
  UserPageDto,
  UsersQueryDto,
} from './dto/admin.dto.js';
import { PlansService } from './plans.service.js';
import { UsersService } from './users.service.js';

/** Enums fijos: cambiarlos exige una migración y actualizar la app. */
const SYSTEM_ENUMS: SystemEnumDto[] = [
  {
    name: 'UserRole',
    description: 'Roles de usuario',
    values: Object.values(UserRole),
  },
  {
    name: 'Sport',
    description: 'Deportes de las canchas',
    values: Object.values(Sport),
  },
  {
    name: 'DayOfWeek',
    description: 'Días de la semana de horarios y tarifas',
    values: Object.values(DayOfWeek),
  },
  {
    name: 'CourtPhotoSlot',
    description: 'Posiciones de las fotos de una cancha',
    values: Object.values(CourtPhotoSlot),
  },
  {
    name: 'ReservationStatus',
    description: 'Estados de una reserva',
    values: Object.values(ReservationStatus),
  },
  {
    name: 'PaymentStatus',
    description: 'Estados de validación de un pago',
    values: Object.values(PaymentStatus),
  },
  {
    name: 'PaymentConcept',
    description: 'Concepto de un pago',
    values: Object.values(PaymentConcept),
  },
];

@ApiTags('admin')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly clientsService: ClientsService,
    private readonly usersService: UsersService,
    private readonly plansService: PlansService,
    private readonly courtsService: CourtsService,
    private readonly reservationsService: ReservationsService,
    private readonly customersService: CustomersService,
    private readonly refundsService: RefundsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas generales de la plataforma' })
  dashboard(): Promise<DashboardDto> {
    return this.dashboardService.getDashboard();
  }

  @Get('clients')
  @ApiOperation({ summary: 'Listado de clientes (negocios)' })
  findClients(@Query() query: PageQueryDto): Promise<ClientPageDto> {
    return this.clientsService.findAll(query);
  }

  @Get('clients/:id')
  @ApiOperation({
    summary:
      'Ficha del cliente: negocio, responsable, plan, canchas y actividad',
  })
  findClient(@Param('id', ParseUUIDPipe) id: string): Promise<ClientDetailDto> {
    return this.clientsService.findOne(id);
  }

  @Get('clients/:id/courts')
  @ApiOperation({
    summary: 'Canchas del cliente con horarios, tarifas y fotos',
  })
  async findClientCourts(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourtDto[]> {
    await this.clientsService.requireClient(id);
    return this.courtsService.listForBusiness(id);
  }

  @Patch('clients/:id/courts/:courtId')
  @ApiOperation({
    summary:
      'Editar una cancha del cliente (mismas reglas que el negocio; schedules y rates reemplazan la lista)',
  })
  async updateClientCourt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: UpdateCourtDto,
  ): Promise<CourtDto> {
    await this.clientsService.requireClient(id);
    return this.courtsService.updateForBusiness(id, courtId, dto);
  }

  @Get('clients/:id/courts/:courtId/availability')
  @ApiOperation({ summary: 'Turnos de un día de una cancha del cliente' })
  async clientCourtAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityDto> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.availability(id, courtId, query.date);
  }

  @Get('clients/:id/reservations')
  @ApiOperation({ summary: 'Agenda de un día del cliente (todas sus canchas)' })
  async clientReservations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DayQueryDto,
  ): Promise<ReservationDto[]> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.listForDay(id, query.date);
  }

  @Post('clients/:id/reservations')
  @ApiOperation({
    summary: 'Crear una reserva para el cliente (mismas reglas que el negocio)',
  })
  async createClientReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.createForBusiness(id, dto);
  }

  @Post('clients/:id/reservations/:reservationId/cancel')
  @ApiOperation({
    summary: 'Cancelar una reserva del cliente con su motivo',
  })
  async cancelClientReservation(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: CancelReservationDto,
  ): Promise<ReservationDto> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.cancelForBusiness(
      id,
      reservationId,
      dto,
      user.sub,
    );
  }

  @Get('clients/:id/customers')
  @ApiOperation({ summary: 'Buscar clientes (personas) del negocio' })
  async clientCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomerSearchDto,
  ): Promise<CustomerDto[]> {
    await this.clientsService.requireClient(id);
    return this.customersService.search(id, query.search);
  }

  @Get('clients/:id/refunds')
  @ApiOperation({ summary: 'Devoluciones del negocio' })
  async clientRefunds(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RefundDto[]> {
    await this.clientsService.requireClient(id);
    return this.refundsService.listForBusiness(id);
  }

  @Post('clients')
  @ApiOperation({
    summary: 'Crear un cliente: usuario de negocio + negocio + plan',
  })
  createClient(@Body() dto: CreateClientDto): Promise<ClientDto> {
    return this.clientsService.create(dto);
  }

  @Patch('clients/:id/subscription')
  @ApiOperation({ summary: 'Cambiar el plan o activar/suspender al cliente' })
  updateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<ClientDto> {
    return this.clientsService.updateSubscription(id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listado de usuarios' })
  findUsers(@Query() query: UsersQueryDto): Promise<UserPageDto> {
    return this.usersService.findAll(query);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Planes de suscripción' })
  findPlans(): Promise<PlanDto[]> {
    return this.plansService.findAll();
  }

  @Post('plans')
  @ApiOperation({ summary: 'Crear un plan' })
  createPlan(@Body() dto: CreatePlanDto): Promise<PlanDto> {
    return this.plansService.create(dto);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Editar un plan' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanDto> {
    return this.plansService.update(id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un plan sin clientes' })
  removePlan(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.plansService.remove(id);
  }

  @Get('enums')
  @ApiOperation({ summary: 'Enums fijos del sistema (solo lectura)' })
  enums(): SystemEnumDto[] {
    return SYSTEM_ENUMS;
  }
}
