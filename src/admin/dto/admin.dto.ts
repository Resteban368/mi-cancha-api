import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CityRefDto } from '../../catalogs/dto/location.dto.js';
import {
  BookingLinkDto,
  BusinessPhotoDto,
} from '../../businesses/dto/business.dto.js';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import {
  PaymentConcept,
  PaymentStatus,
  ReservationStatus,
  Sport,
  UserRole,
} from '../../generated/prisma/enums.js';

// ---------- Dashboard ----------

export class CountByLabelDto {
  label: string;
  count: number;
}

export class MonthlySignupsDto {
  /** Mes en formato YYYY-MM. */
  month: string;
  clients: number;
  players: number;
}

export class DashboardDto {
  clients: { total: number; active: number; newLast30Days: number };
  users: {
    total: number;
    superAdmins: number;
    businessAdmins: number;
    players: number;
  };
  activeCourts: number;
  reservationsLast30Days: number;
  /** Suma del precio mensual de las suscripciones activas (COP). */
  monthlyRecurringRevenue: number;
  clientsByPlan: CountByLabelDto[];
  signupsByMonth: MonthlySignupsDto[];
}

// ---------- Clientes ----------

export class CreateClientDto {
  /** Nombre del administrador del negocio. @example Andrés Gómez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  /** @example contacto@golazo.co */
  @IsEmail()
  email: string;

  /** Contraseña inicial (mín. 8). */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /** @example 3001234567 */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** @example Complejo Deportivo El Golazo */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName: string;

  /** @example Calle 15 # 8-32 */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  /** @example Barrio Centro */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  neighborhood: string;

  /** Ciudad del negocio (GET /catalogs/departments/:id/cities); de ella sale el departamento. */
  @IsUUID()
  cityId: string;

  @IsUUID()
  planId: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ClientDto {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  /** Ciudad y departamento; null en negocios anteriores que aún no la completan. */
  city: CityRefDto | null;
  createdAt: Date;
  owner: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
  plan: { id: string; name: string; monthlyPrice: number } | null;
  subscriptionActive: boolean;
  nextPayment: Date | null;
  activeCourts: number;
}

export class UpdateClientDto {
  /** Ciudad del negocio (GET /catalogs/departments/:id/cities). */
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  latitude?: number | null;

  @IsOptional()
  longitude?: number | null;
}

export class ClientPageDto {
  @ApiProperty({ type: [ClientDto] })
  items: ClientDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CatalogRefDto {
  code: string;
  name: string;
}

export class ClientOwnerDetailDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: Date;
}

export class ClientSubscriptionDto {
  plan: { id: string; name: string; monthlyPrice: number; courtLimit: number };
  since: Date;
  nextPayment: Date;
  isActive: boolean;
  autoBilling: boolean;
}

export class ClientCourtDto {
  id: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  isCovered: boolean;
  /** Código ISO 4217 de los precios. */
  currency: string;
  basePricePerHour: number;
  isActive: boolean;
  /** Tiene las 3 fotos obligatorias. */
  isComplete: boolean;
}

export class ClientStatsDto {
  reservationsTotal: number;
  reservationsLast30Days: number;
  /** Reservas confirmadas desde ahora en adelante. */
  upcomingReservations: number;
  /** Pagos aprobados en los últimos 30 días, en COP. */
  approvedRevenueLast30Days: number;
  pendingPayments: number;
}

export class ClientReservationDto {
  id: string;
  start: Date;
  end: Date;
  courtName: string;
  customerName: string;
  totalPrice: number;
  currency: string;
  @ApiProperty({ enum: ReservationStatus })
  status: ReservationStatus;
  cancellationReason: string | null;
}

export class ClientPaymentDto {
  id: string;
  receivedAt: Date;
  customerName: string;
  amount: number;
  method: string;
  @ApiProperty({ enum: PaymentConcept })
  concept: PaymentConcept;
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;
}

/** Toda la información de un cliente para la ficha del panel. */
export class ClientDetailDto {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  description: string | null;
  /** URL pública de la foto de portada; null si no tiene. */
  imageUrl: string | null;
  /** Fotos del negocio (hasta 5) en orden; la primera es la portada. */
  photos: BusinessPhotoDto[];
  /** Ciudad y departamento; null si aún no la completan. */
  city: CityRefDto | null;
  /** Link de reservas del negocio y si ya está activo. */
  bookingLink: BookingLinkDto;
  latitude: number | null;
  longitude: number | null;
  amenities: CatalogRefDto[];
  createdAt: Date;
  updatedAt: Date;
  owner: ClientOwnerDetailDto;
  subscription: ClientSubscriptionDto | null;
  courts: ClientCourtDto[];
  stats: ClientStatsDto;
  /** Las 10 reservas más recientes por fecha de juego. */
  recentReservations: ClientReservationDto[];
  /** Los 10 pagos más recientes. */
  recentPayments: ClientPaymentDto[];
}

// ---------- Usuarios ----------

export class UsersQueryDto extends PageQueryDto {
  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** true = solo cuentas bloqueadas; false = solo activas. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  banned?: boolean;
}

export class AdminUserDto {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  @ApiProperty({ enum: UserRole })
  role: UserRole;
  verified: boolean;
  createdAt: Date;
  /** Negocio que administra (si es ADMIN_NEGOCIO). */
  businessName: string | null;
  /** Formas de iniciar sesión: password, google, apple. */
  authProviders: string[];
  /** Cuándo se bloqueó la cuenta; null si está activa. */
  bannedAt: Date | null;
  bannedReason: string | null;
}

export class UserPageDto {
  @ApiProperty({ type: [AdminUserDto] })
  items: AdminUserDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Planes ----------

export class PlanBenefitInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title: string;

  @IsString()
  @MaxLength(200)
  detail: string;
}

export class CreatePlanDto {
  /** @example Pro */
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  /** Precio mensual en COP. @example 179000 */
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyPrice: number;

  /** Canchas activas permitidas. @example 8 */
  @IsInt()
  @Min(1)
  @Max(500)
  courtLimit: number;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanBenefitInputDto)
  benefits: PlanBenefitInputDto[];
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

export class PlanDto extends OmitType(CreatePlanDto, [] as const) {
  id: string;
  /** Negocios suscritos a este plan. */
  subscriptions: number;
}

// ---------- Enums ----------

export class SystemEnumDto {
  name: string;
  description: string;
  values: string[];
}
