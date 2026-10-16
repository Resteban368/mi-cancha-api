import {
  Body,
  Controller,
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
import { Public } from '../common/auth/public.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { LoginRateLimit, RegisterRateLimit } from '../common/rate-limit.js';
import { UserRole } from '../generated/prisma/enums.js';
import {
  ReservationDto,
  SportAvailabilityDto,
} from '../reservations/dto/reservation.dto.js';
import {
  LoginPlayerDto,
  OnlineBookingSettingsDto,
  PlayerDto,
  PlayerSessionDto,
  PublicAvailabilityQueryDto,
  PublicBusinessDto,
  RegisterPlayerDto,
  UpdateOnlineBookingDto,
  WebReservationDto,
} from './dto/online-booking.dto.js';
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
  @Get('businesses/:slug')
  @ApiOperation({ summary: 'Información pública del negocio para reservar' })
  business(@Param('slug') slug: string): Promise<PublicBusinessDto> {
    return this.booking.publicBusiness(slug);
  }

  @Public()
  @Get('businesses/:slug/availability')
  @ApiOperation({
    summary: 'Turnos de un día de todas las canchas de un deporte',
  })
  availability(
    @Param('slug') slug: string,
    @Query() query: PublicAvailabilityQueryDto,
  ): Promise<SportAvailabilityDto> {
    return this.booking.availability(slug, query.sport, query.date);
  }

  @Public()
  @RegisterRateLimit()
  @Post('auth/register')
  @ApiOperation({ summary: 'Registrar una cuenta de jugador' })
  register(@Body() dto: RegisterPlayerDto): Promise<PlayerSessionDto> {
    return this.players.register(dto);
  }

  @Public()
  @LoginRateLimit()
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
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Datos de la cuenta del jugador' })
  me(@CurrentUser() user: AuthPayload): Promise<PlayerDto> {
    return this.players.me(user.sub);
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
