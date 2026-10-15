import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Sport } from '../../generated/prisma/enums.js';
import { MAX_SLOTS } from '../../reservations/dto/reservation.dto.js';

/** Versión vigente de la política de tratamiento de datos que acepta el jugador. */
export const DATA_POLICY_VERSION = '2026-10-15';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class RegisterPlayerDto {
  /** @example Laura Gómez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  /** @example laura@correo.com */
  @IsEmail({}, { message: 'email no es un correo válido' })
  @MaxLength(120)
  email: string;

  /** Celular; 10 dígitos se guardan con +57. @example 311 555 0001 */
  @Matches(/^\+?[\d\s()-]{7,20}$/, {
    message: 'phone debe ser un celular válido (7 a 20 dígitos)',
  })
  phone: string;

  /** Cédula; se ignoran puntos, espacios y guiones. @example 1.075.111.222 */
  @Matches(/^[\dA-Za-z.\s-]{4,20}$/, {
    message: 'documentId debe tener entre 4 y 20 caracteres (letras o números)',
  })
  documentId: string;

  /** Mínimo 8 caracteres. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /** Opcional. @example 1995-04-21 */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate debe tener formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  birthDate?: string;

  @ApiProperty({ enum: Sport, required: false })
  @IsOptional()
  @IsEnum(Sport)
  favoriteSport?: Sport;

  /** Debe ser true: aceptación de la política de tratamiento de datos. */
  @Equals(true, {
    message: 'Debes aceptar la política de tratamiento de datos',
  })
  acceptDataPolicy: boolean;
}

export class LoginPlayerDto {
  /** Celular o cédula. @example 3115550001 */
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  identifier: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class PlayerDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  birthDate: string | null;
  @ApiProperty({ enum: Sport, nullable: true })
  favoriteSport: Sport | null;
}

export class PlayerSessionDto {
  accessToken: string;
  player: PlayerDto;
}

export class WebReservationDto {
  @IsUUID()
  courtId: string;

  /** Inicio del primer turno, tal como llega en la disponibilidad. */
  @IsISO8601({ strict: true })
  start: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SLOTS)
  slots: number;

  /** Notas para la sede (se guardan en contactNote). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class PublicAvailabilityQueryDto {
  /** @example 2026-10-20 */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  date: string;

  @ApiProperty({ enum: Sport })
  @IsEnum(Sport)
  sport: Sport;
}

export class BookingRulesDto {
  minAdvanceMinutes: number;
  maxDaysAhead: number;
  maxReservationsPerDay: number;
  maxSlots: number;
  /** Las reservas web se pagan en la sede. */
  paymentMethod: string;
}

export class PublicBusinessDto {
  name: string;
  slug: string;
  address: string;
  neighborhood: string;
  description: string | null;
  amenities: { code: string; name: string }[];
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Abre Google Maps en el punto (o la dirección si no hay punto). */
  mapsUrl: string;
  /** Deportes con al menos una cancha reservable. */
  @ApiProperty({ enum: Sport, isArray: true })
  sports: Sport[];
  currency: string;
  rules: BookingRulesDto;
  bookingAvailable: boolean;
  /** Por qué no se puede reservar: DISABLED, PLAN_INACTIVE o NO_COURTS. */
  unavailableReason: string | null;
}

export class OnlineBookingSettingsDto {
  enabled: boolean;
  slug: string;
  /** Link para compartir. */
  url: string;
  bookingAvailable: boolean;
  unavailableReason: string | null;
}

export class UpdateOnlineBookingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Minúsculas, números y guiones (3 a 60). @example complejo-el-golazo */
  @IsOptional()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message: 'slug solo puede tener minúsculas, números y guiones',
  })
  slug?: string;
}
