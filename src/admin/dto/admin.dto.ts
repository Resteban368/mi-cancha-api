import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
import { PageQueryDto } from '../../common/dto/page.dto.js';
import { UserRole } from '../../generated/prisma/enums.js';

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

export class ClientPageDto {
  @ApiProperty({ type: [ClientDto] })
  items: ClientDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Usuarios ----------

export class UsersQueryDto extends PageQueryDto {
  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
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
