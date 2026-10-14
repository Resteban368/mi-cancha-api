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
