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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthPayload } from '../common/auth/auth-payload.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { clientIp } from '../otp/client-ip.js';
import { OtpSentDto } from '../otp/dto/otp.dto.js';
import {
  ReservationDto,
  SportAvailabilityDto,
} from '../reservations/dto/reservation.dto.js';
import {
  CurrentHoldDto,
  DirectoryPageDto,
  DirectoryQueryDto,
  LoginPlayerDto,
  OnlineBookingSettingsDto,
  PasswordResetCodeDto,
  PlayerBusinessDto,
  PlayerDto,
  PlayerSessionDto,
  PublicAmenityDto,
  PublicAvailabilityQueryDto,
  PublicBusinessDto,
  RegisterPlayerDto,
  ResetPasswordDto,
  SlotHoldDto,
  StartRegistrationDto,
  UpdatePlayerProfileDto,
  UpdateOnlineBookingDto,
  WebHoldDto,
  WebReservationDto,
} from './dto/online-booking.dto.js';
import {
  PlayerReservationPageDto,
  PlayerReservationsQueryDto,
  PlayerStatsDto,
} from '../reservations/dto/player-history.dto.js';
import { PlayerHistoryService } from '../reservations/player-history.service.js';
import { OnlineBookingService } from './online-booking.service.js';
import { PlayerAuthService } from './player-auth.service.js';

/** Sin token: página del negocio, turnos y cuentas de jugador. */
@ApiTags('public / reservas en línea')
@Controller('public')
export class PublicBookingController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly players: PlayerAuthService,
  ) {}

  @Public()
  @Get('businesses')
  @ApiOperation({
    summary:
      'Directorio de sedes que reciben reservas: filtros, orden por cercanía (lat y lng) y paginación',
  })
  directory(@Query() query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    return this.booking.directory(query);
  }

  @Public()
  @Get('amenities')
  @ApiOperation({ summary: 'Servicios activos para filtrar el directorio' })
  amenities(): Promise<PublicAmenityDto[]> {
    return this.booking.publicAmenities();
  }

  @Public()
  @Get('businesses/:slug')
  @ApiOperation({ summary: 'Información pública del negocio para reservar' })
  business(@Param('slug') slug: string): Promise<PublicBusinessDto> {
    return this.booking.publicBusiness(slug);
  }

  @Public()
  @Get('businesses/:slug/availability')
  @ApiOperation({
    summary:
      'Turnos de un día de todas las canchas de un deporte (HELD = otro jugador los apartó)',
  })
  availability(
    @Param('slug') slug: string,
    @Query() query: PublicAvailabilityQueryDto,
  ): Promise<SportAvailabilityDto> {
    return this.booking.availability(slug, query.sport, query.date);
  }

  @Public()
  @Post('auth/register/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registro, paso 1: si el celular está libre, le envía el código por SMS',
  })
  startRegistration(
    @Body() dto: StartRegistrationDto,
    @Req() req: Request,
  ): Promise<OtpSentDto> {
    return this.players.startRegistration(dto, clientIp(req));
  }

  @Public()
  @Post('auth/register')
  @ApiOperation({
    summary:
      'Registro, paso 2: crea la cuenta con el código del SMS o el token de /otp/verify',
  })
  register(@Body() dto: RegisterPlayerDto): Promise<PlayerSessionDto> {
    return this.players.register(dto);
  }

  @Public()
  @Post('auth/password/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Olvidé mi contraseña: envía un código por SMS si el celular tiene cuenta (responde igual si no)',
  })
  requestPasswordReset(
    @Body() dto: PasswordResetCodeDto,
    @Req() req: Request,
  ): Promise<OtpSentDto> {
    return this.players.requestPasswordReset(dto, clientIp(req));
  }

  @Public()
  @Post('auth/password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nueva contraseña con el código del SMS; deja la sesión iniciada',
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<PlayerSessionDto> {
    return this.players.resetPassword(dto);
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con celular o cédula y contraseña' })
  login(@Body() dto: LoginPlayerDto): Promise<PlayerSessionDto> {
    return this.players.login(dto);
  }
}

@ApiTags('player')
@ApiBearerAuth()
@Roles([UserRole.JUGADOR])
@Controller('player')
export class PlayerController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly players: PlayerAuthService,
    private readonly history: PlayerHistoryService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Datos de la cuenta del jugador' })
  me(@CurrentUser() user: AuthPayload): Promise<PlayerDto> {
    return this.players.me(user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary:
      'Mi perfil: completar o cambiar nombre, correo, cédula, nacimiento y deporte',
  })
  updateMe(
    @CurrentUser() user: AuthPayload,
    @Body() dto: UpdatePlayerProfileDto,
  ): Promise<PlayerDto> {
    return this.players.updateProfile(user.sub, dto);
  }

  @Get('businesses')
  @ApiOperation({
    summary: 'Mis sedes: los negocios donde ya soy cliente (tengo al menos una reserva)',
  })
  myBusinesses(@CurrentUser() user: AuthPayload): Promise<PlayerBusinessDto[]> {
    return this.booking.myBusinesses(user.sub);
  }

  @Get('reservations')
  @ApiOperation({
    summary:
      'Todas mis reservas en todas las sedes, con filtros por estado (próximas, jugadas, canceladas, no asistí), deporte y sede',
  })
  allReservations(
    @CurrentUser() user: AuthPayload,
    @Query() query: PlayerReservationsQueryDto,
  ): Promise<PlayerReservationPageDto> {
    return this.history.list(user.sub, query);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Mi resumen: partidos jugados, horas, próximas, canceladas, deporte y sede favoritos y actividad de los últimos meses',
  })
  stats(@CurrentUser() user: AuthPayload): Promise<PlayerStatsDto> {
    return this.history.stats(user.sub);
  }

  @Post('businesses/:slug/reservations')
  @ApiOperation({
    summary:
      'Reservar desde la web: queda confirmada y se paga en efectivo en la sede',
  })
  book(
    @CurrentUser() user: AuthPayload,
    @Param('slug') slug: string,
    @Body() dto: WebReservationDto,
  ): Promise<ReservationDto> {
    return this.booking.book(slug, user.sub, dto);
  }

  @Get('businesses/:slug/hold')
  @ApiOperation({ summary: 'Mi apartado vigente en este negocio' })
  currentHold(
    @CurrentUser() user: AuthPayload,
    @Param('slug') slug: string,
  ): Promise<CurrentHoldDto> {
    return this.booking.currentHold(slug, user.sub);
  }

  @Put('businesses/:slug/hold')
  @ApiOperation({
    summary:
      'Apartar turnos mientras confirmo (3 min, máx. 3 turnos); reemplaza el apartado anterior',
  })
  hold(
    @CurrentUser() user: AuthPayload,
    @Param('slug') slug: string,
    @Body() dto: WebHoldDto,
  ): Promise<SlotHoldDto> {
    return this.booking.hold(slug, user.sub, dto);
  }

  @Delete('businesses/:slug/hold')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soltar mi apartado' })
  releaseHold(
    @CurrentUser() user: AuthPayload,
    @Param('slug') slug: string,
  ): Promise<void> {
    return this.booking.releaseHold(slug, user.sub);
  }

  @Get('businesses/:slug/reservations')
  @ApiOperation({ summary: 'Mis reservas en este negocio' })
  myReservations(
    @CurrentUser() user: AuthPayload,
    @Param('slug') slug: string,
  ): Promise<ReservationDto[]> {
    return this.booking.myReservations(slug, user.sub);
  }
}

@ApiTags('business / online booking')
@ApiBearerAuth()
@Roles([UserRole.ADMIN_NEGOCIO])
@Controller('business/online-booking')
export class BusinessOnlineBookingController {
  constructor(private readonly booking: OnlineBookingService) {}

  @Get()
  @ApiOperation({ summary: 'Link público de reservas y si está activo' })
  settings(
    @CurrentUser() user: AuthPayload,
  ): Promise<OnlineBookingSettingsDto> {
    return this.booking.settings(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Activar o desactivar el link, o cambiar su slug' })
  update(
    @CurrentUser() user: AuthPayload,
    @Body() dto: UpdateOnlineBookingDto,
  ): Promise<OnlineBookingSettingsDto> {
    return this.booking.updateSettings(user.sub, dto);
  }
}

/** El link de reservas de cada negocio, para el super admin. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles([UserRole.SUPER_ADMIN])
@Controller('admin/clients')
export class AdminOnlineBookingController {
  constructor(private readonly booking: OnlineBookingService) {}

  @Get(':id/online-booking')
  @ApiOperation({ summary: 'Link público de reservas del cliente' })
  settings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OnlineBookingSettingsDto> {
    return this.booking.settingsFor(id);
  }

  @Patch(':id/online-booking')
  @ApiOperation({
    summary: 'Activar o desactivar el link del cliente, o cambiar su slug',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOnlineBookingDto,
  ): Promise<OnlineBookingSettingsDto> {
    // Si el negocio no existe, Prisma responde P2025 y el filtro lo vuelve 404.
    return this.booking.updateSettingsFor(id, dto);
  }
}
