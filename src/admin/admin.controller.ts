import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
import { ReorderPhotosDto } from '../businesses/dto/business.dto.js';
import { BusinessImagesService } from '../businesses/business-images.service.js';
import { CourtPhotosService } from '../courts/court-photos.service.js';
import { CourtsService } from '../courts/courts.service.js';
import { CourtDto, UpdateCourtDto } from '../courts/dto/court.dto.js';
import { CustomersService } from '../customers/customers.service.js';
import {
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from '../storage/image-upload.js';
import {
  CreateCustomerDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerPageDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from '../customers/dto/customer.dto.js';
import { RefundDto, RefundsService } from '../refunds/refunds.service.js';
import {
  AvailabilityDto,
  AvailabilityQueryDto,
  CancelReservationDto,
  CreateReservationDto,
  ReservationDto,
  ReservationPageDto,
  ReservationsQueryDto,
  SportAvailabilityDto,
  SportAvailabilityQueryDto,
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
  DeleteUsersDto,
  DeleteUsersResultDto,
  UpdateClientDto,
  UpdateClientOwnerDto,
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
    private readonly businessImagesService: BusinessImagesService,
    private readonly courtPhotosService: CourtPhotosService,
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

  @Patch('clients/:id')
  @ApiOperation({
    summary: 'Actualizar datos generales o ubicación del cliente',
  })
  updateClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientDetailDto> {
    return this.clientsService.update(id, dto);
  }

  @Patch('clients/:id/owner')
  @ApiOperation({
    summary: 'Editar nombre, correo o celular del responsable del cliente',
  })
  updateClientOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientOwnerDto,
  ): Promise<ClientDetailDto> {
    return this.clientsService.updateOwner(id, dto);
  }

  @Delete('clients/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Eliminar el cliente de forma definitiva (negocio, canchas, reservas, pagos y la cuenta del responsable)',
  })
  removeClient(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clientsService.remove(id);
  }

  @Put('clients/:id/image')
  @ApiOperation({
    summary: 'Subir o reemplazar el logo/foto de portada del cliente (negocio)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadClientImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<ClientDetailDto> {
    await this.clientsService.requireClient(id);
    await this.businessImagesService.uploadForBusiness(id, file);
    return this.clientsService.findOne(id);
  }

  @Post('clients/:id/photos')
  @ApiOperation({
    summary: 'Agregar una foto al negocio del cliente (hasta 5)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async addClientPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<ClientDetailDto> {
    await this.clientsService.requireClient(id);
    await this.businessImagesService.addForBusiness(id, file);
    return this.clientsService.findOne(id);
  }

  @Put('clients/:id/photos/order')
  @ApiOperation({
    summary: 'Ordenar las fotos del negocio; la primera es la portada',
  })
  async sortClientPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderPhotosDto,
  ): Promise<ClientDetailDto> {
    await this.clientsService.requireClient(id);
    await this.businessImagesService.reorder(id, dto.ids);
    return this.clientsService.findOne(id);
  }

  @Delete('clients/:id/photos/:photoId')
  @ApiOperation({ summary: 'Quitar una foto del negocio del cliente' })
  async removeClientPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<ClientDetailDto> {
    await this.clientsService.requireClient(id);
    await this.businessImagesService.removePhoto(id, photoId);
    return this.clientsService.findOne(id);
  }

  @Delete('clients/:id/image')
  @ApiOperation({
    summary: 'Eliminar el logo/foto de portada del cliente (negocio)',
  })
  async removeClientImage(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientDetailDto> {
    await this.clientsService.requireClient(id);
    await this.businessImagesService.removeForBusiness(id);
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

  @Delete('clients/:id/courts/:courtId/photos/:slot')
  @ApiOperation({
    summary:
      'Eliminar una foto de una cancha del cliente (sin la principal la cancha deja de recibir reservas)',
  })
  @ApiParam({ name: 'slot', enum: CourtPhotoSlot })
  async removeClientCourtPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Param('slot', new ParseEnumPipe(CourtPhotoSlot)) slot: CourtPhotoSlot,
  ): Promise<CourtDto> {
    await this.clientsService.requireClient(id);
    return this.courtPhotosService.removeForBusiness(id, courtId, slot);
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

  @Get('clients/:id/availability')
  @ApiOperation({
    summary: 'Turnos de un día de todas las canchas de un deporte del cliente',
  })
  async clientSportAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SportAvailabilityQueryDto,
  ): Promise<SportAvailabilityDto> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.sportAvailability(
      id,
      query.sport,
      query.date,
    );
  }

  @Get('clients/:id/reservations')
  @ApiOperation({
    summary:
      'Reservas del cliente: con date, la agenda de ese día; sin date, paginadas con filtros',
  })
  async clientReservations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReservationsQueryDto,
  ): Promise<ReservationDto[] | ReservationPageDto> {
    await this.clientsService.requireClient(id);
    return this.reservationsService.listForBusiness(id, query);
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
  @ApiOperation({
    summary:
      'Clientes (personas) del negocio: con page, listado paginado con métricas; sin page, búsqueda rápida (máx. 20)',
  })
  async clientCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomerQueryDto,
  ): Promise<CustomerDto[] | CustomerPageDto> {
    await this.clientsService.requireClient(id);
    if (query.page !== undefined) {
      return this.customersService.findPaginated(id, query);
    }
    return this.customersService.search(id, query.search);
  }

  @Post('clients/:id/customers')
  @ApiOperation({ summary: 'Registrar un cliente (persona) del negocio' })
  async createClientCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    await this.clientsService.requireClient(id);
    return this.customersService.create(id, dto);
  }

  @Patch('clients/:id/customers/:customerId')
  @ApiOperation({ summary: 'Editar un cliente (persona) del negocio' })
  async updateClientCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    await this.clientsService.requireClient(id);
    return this.customersService.update(id, customerId, dto);
  }

  @Get('clients/:id/customers/:customerId')
  @ApiOperation({
    summary:
      'Ficha del cliente del negocio con todas sus reservas y pagos en detalle',
  })
  async clientCustomerDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<CustomerDetailDto> {
    await this.clientsService.requireClient(id);
    return this.customersService.findOneDetail(id, customerId);
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

  @Post('users/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Eliminar varios jugadores de forma definitiva (ignora negocios y super admins)',
  })
  deleteUsers(@Body() dto: DeleteUsersDto): Promise<DeleteUsersResultDto> {
    return this.usersService.removePlayers(dto.ids);
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
