import { CityRefDto } from '../../catalogs/dto/location.dto.js';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CourtPhotoDto,
  CourtRateDto,
  CourtScheduleDto,
  CourtSurfaceRefDto,
} from '../../courts/dto/court.dto.js';
import { Sport } from '../../generated/prisma/enums.js';
import {
  OTP_CODE,
  OTP_CODE_MESSAGE,
  PHONE_MESSAGE,
} from '../../otp/dto/otp.dto.js';
import { MAX_GROUP_COURTS } from '../../reservations/dto/reservation.dto.js';

/** Turnos seguidos que un jugador puede apartar y reservar desde la web. */
export const WEB_MAX_SLOTS = 3;
/** Minutos que dura un apartado si el jugador no confirma. */
export const WEB_HOLD_MINUTES = 3;

/** Versión vigente de la política de tratamiento de datos que acepta el jugador. */
export const DATA_POLICY_VERSION = '2026-10-15';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Prueba de que el celular es del jugador: el código del SMS o el token de /otp/verify. */
class PhoneProofDto {
  /** Código de 6 dígitos del SMS. Envía esto o `verificationToken`. @example 123456 */
  @ValidateIf((d: PhoneProofDto) => !d.verificationToken)
  @Matches(OTP_CODE, { message: OTP_CODE_MESSAGE })
  code?: string;

  /** Token de POST /public/auth/otp/verify. Envía esto o `code`. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  verificationToken?: string;
}

/** Registro: nombre, celular y contraseña. Lo demás se completa en "Mi perfil". */
export class StartRegistrationDto {
  /** @example Laura Gómez */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  /** Celular de Colombia; recibe el código por SMS y sirve para ingresar. @example 311 555 0001 */
  @IsPhoneNumber('CO', { message: PHONE_MESSAGE })
  phone: string;

  /** Mínimo 8 caracteres. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /** Debe ser true: aceptación de la política de tratamiento de datos. */
  @Equals(true, {
    message: 'Debes aceptar la política de tratamiento de datos',
  })
  acceptDataPolicy: boolean;
}

/** Los mismos datos más la prueba de que el celular es suyo. */
export class RegisterPlayerDto extends StartRegistrationDto {
  /** @example 123456 */
  @ValidateIf((d: RegisterPlayerDto) => !d.verificationToken)
  @Matches(OTP_CODE, { message: OTP_CODE_MESSAGE })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  verificationToken?: string;
}

export class PasswordResetCodeDto {
  /** Celular de la cuenta. @example 311 555 0001 */
  @IsPhoneNumber('CO', { message: PHONE_MESSAGE })
  phone: string;
}

export class ResetPasswordDto extends PhoneProofDto {
  /** Celular de la cuenta. @example 311 555 0001 */
  @IsPhoneNumber('CO', { message: PHONE_MESSAGE })
  phone: string;

  /** Contraseña nueva, mínimo 8 caracteres. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

/** "Mi perfil": datos que el jugador completa después de registrarse. */
export class UpdatePlayerProfileDto {
  /** @example Laura Gómez */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  /** @example laura@correo.com */
  @IsOptional()
  @IsEmail({}, { message: 'email no es un correo válido' })
  @MaxLength(120)
  email?: string;

  /** Cédula; se ignoran puntos, espacios y guiones. @example 1.075.111.222 */
  @IsOptional()
  @Matches(/^[\dA-Za-z.\s-]{4,20}$/, {
    message: 'documentId debe tener entre 4 y 20 caracteres (letras o números)',
  })
  documentId?: string;

  /** null la quita. @example 1995-04-21 */
  @ApiProperty({ type: String, nullable: true, required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate debe tener formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  birthDate?: string | null;

  /** null lo quita. */
  @ApiProperty({ enum: Sport, nullable: true, required: false })
  @IsOptional()
  @IsEnum(Sport)
  favoriteSport?: Sport | null;
}

export class LoginPlayerDto {
  /** Celular (o la cédula, si ya la registró en su perfil). @example 3115550001 */
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
  /** La cuenta la creó un negocio con la cédula como clave: debe cambiarla al ingresar. */
  mustChangePassword: boolean;
  /** Aún no aceptó la política de tratamiento de datos. */
  needsDataConsent: boolean;
}

export class ChangePlayerPasswordDto {
  /** Contraseña actual (si la cuenta la creó un negocio, es su cédula). */
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class PlayerSessionDto {
  accessToken: string;
  player: PlayerDto;
}

export class WebHoldDto {
  /**
   * 1 a 3 canchas del mismo deporte y turno, libres en la misma franja (para
   * jugar varias canchas a la vez). Envía esto o `courtId`.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_COURTS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  courtIds?: string[];

  /** Una sola cancha (equivale a `courtIds` con una). */
  @IsOptional()
  @IsUUID()
  courtId?: string;

  /** Inicio del primer turno, tal como llega en la disponibilidad. */
  @IsISO8601({ strict: true })
  start: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(WEB_MAX_SLOTS)
  slots: number;
}

export class WebReservationDto extends WebHoldDto {
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

export class SlotHoldDto {
  /** Canchas apartadas, todas en la misma franja. */
  courtIds: string[];
  /** Inicio del primer turno y fin del último. */
  start: Date;
  end: Date;
  slots: number;
  /** Cuándo se libera si no se confirma. */
  expiresAt: Date;
}

export class CurrentHoldDto {
  @ApiProperty({ type: SlotHoldDto, nullable: true })
  hold: SlotHoldDto | null;
}

/** Cancha reservable con lo que el jugador necesita para elegirla. */
export class PublicCourtDto {
  id: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  isCovered: boolean;
  currency: string;
  /** Precio por hora donde ninguna tarifa aplica. */
  basePricePerHour: number;
  slotDuration: number;
  @ApiProperty({ type: CourtSurfaceRefDto, nullable: true })
  surface: CourtSurfaceRefDto | null;
  @ApiProperty({ type: Number, nullable: true })
  lengthMeters: number | null;
  @ApiProperty({ type: Number, nullable: true })
  widthMeters: number | null;
  @ApiProperty({ type: Number, nullable: true })
  playersPerSide: number | null;
  @ApiProperty({ type: [CourtScheduleDto] })
  schedules: CourtScheduleDto[];
  @ApiProperty({ type: [CourtRateDto] })
  rates: CourtRateDto[];
  @ApiProperty({ type: [CourtPhotoDto] })
  photos: CourtPhotoDto[];
}

export class BookingRulesDto {
  minAdvanceMinutes: number;
  maxDaysAhead: number;
  maxReservationsPerDay: number;
  maxSlots: number;
  holdMinutes: number;
  /** Canchas que se pueden reservar a la vez en la misma franja. */
  maxCourts: number;
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
  /** URLs de las fotos de la sede (hasta 5) en orden; la primera es la portada. */
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  /** Abre Google Maps en el punto (o la dirección si no hay punto). */
  mapsUrl: string;
  /** Deportes con al menos una cancha reservable. */
  @ApiProperty({ enum: Sport, isArray: true })
  sports: Sport[];
  currency: string;
  rules: BookingRulesDto;
  /** Canchas reservables (activas y con sus fotos obligatorias). */
  @ApiProperty({ type: [PublicCourtDto] })
  courts: PublicCourtDto[];
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

export class DirectoryQueryDto {
  /** Busca en nombre, barrio y dirección. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  /** Código de un servicio del catálogo, p. ej. PARQUEADERO. */
  @IsOptional()
  @Matches(/^[A-Z_]{2,40}$/, { message: 'amenity no es un código válido' })
  amenity?: string;

  /** Ciudad elegida (id de GET /public/cities): solo trae las sedes de esa ciudad. */
  @IsOptional()
  @IsUUID()
  cityId?: string;

  /** Latitud del usuario (solo si pidió "cerca de mí"). Va junto con lng. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /**
   * Radio en km alrededor de lat/lng: solo trae sedes a esa distancia o menos (las que no
   * tienen punto en el mapa quedan fuera). Exige lat y lng.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Ciudad con sedes que reciben reservas, para el selector del directorio. */
export class DirectoryCityDto {
  id: string;
  name: string;
  department: { id: string; name: string };
  /** Sedes que reciben reservas en esa ciudad. */
  businessCount: number;
}

/** Punto de una sede en el mapa del directorio. */
export class DirectoryMapPointDto {
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
}

export class DirectoryBusinessDto {
  name: string;
  slug: string;
  address: string;
  neighborhood: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  @ApiProperty({ enum: Sport, isArray: true })
  sports: Sport[];
  /** Canchas reservables (activas y con sus fotos obligatorias). */
  courtCount: number;
  amenities: { code: string; name: string }[];
  /** Precio por hora más bajo entre sus canchas reservables; null si no hay. */
  fromPricePerHour: number | null;
  currency: string;
  /** Ciudad y departamento; null en sedes anteriores que aún no la completan. */
  city: CityRefDto | null;
  /** Solo si se pidieron lat y lng. */
  distanceKm: number | null;
}

export class DirectoryPageDto {
  /** Link general de reservas para compartir: /reservar. */
  url: string;
  total: number;
  page: number;
  limit: number;
  @ApiProperty({ type: [DirectoryBusinessDto] })
  businesses: DirectoryBusinessDto[];
}

export class PublicAmenityDto {
  code: string;
  name: string;
}

/** Sede donde el jugador ya es cliente. */
export class PlayerBusinessDto {
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  imageUrl: string | null;
  /** Desde cuándo es cliente (su primera reserva en la sede). */
  clientSince: Date;
}
