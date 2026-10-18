import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CourtPhotoSlot,
  DayOfWeek,
  Sport,
} from '../../generated/prisma/enums.js';
import { CATALOG_CODE_PATTERN } from '../../catalogs/dto/catalog.dto.js';
import { TIME_PATTERN } from '../court-time.js';

export const SLOT_DURATIONS = [30, 60, 90, 120];
const TIME_MESSAGE = 'debe tener formato HH:mm (00:00 a 23:59)';
const MONEY = { maxDecimalPlaces: 2 };
const MAX_PRICE = 1_000_000_000;
const METERS = { maxDecimalPlaces: 2 };
export const MIN_METERS = 1;
export const MAX_METERS = 200;
export const MAX_PLAYERS_PER_SIDE = 11;

export class CourtScheduleDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsBoolean()
  isOpen: boolean;

  /** Hora local de apertura; obligatoria si isOpen. @example 06:00 */
  @ValidateIf((s: CourtScheduleDto) => s.isOpen || s.openTime != null)
  @Matches(TIME_PATTERN, { message: `openTime ${TIME_MESSAGE}` })
  openTime?: string | null;

  /** Hora local de cierre; si es menor que openTime cierra al día siguiente. @example 23:00 */
  @ValidateIf((s: CourtScheduleDto) => s.isOpen || s.closeTime != null)
  @Matches(TIME_PATTERN, { message: `closeTime ${TIME_MESSAGE}` })
  closeTime?: string | null;
}

export class CourtRateDto {
  /** @example Prime / Nocturna L-V */
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  /** Precio por hora en la moneda de la cancha. @example 90000 */
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_PRICE)
  pricePerHour: number;

  /** Días en los que empieza la franja. @example ["MONDAY","TUESDAY"] */
  @ApiProperty({ enum: DayOfWeek, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(DayOfWeek, { each: true })
  days: DayOfWeek[];

  /** @example 18:00 */
  @Matches(TIME_PATTERN, { message: `startTime ${TIME_MESSAGE}` })
  startTime: string;

  /** Si es menor que startTime, la franja termina al día siguiente. @example 23:00 */
  @Matches(TIME_PATTERN, { message: `endTime ${TIME_MESSAGE}` })
  endTime: string;
}

export class CreateCourtDto {
  /** @example Cancha Central Pádel 1 */
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({ enum: Sport })
  @IsEnum(Sport)
  sport: Sport;

  /** true = cubierta o con techo; false = al aire libre. */
  @IsBoolean()
  isCovered: boolean;

  /** Si se omite, true. Para recibir reservas además necesita las 3 fotos obligatorias. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Código ISO 4217. Si se omite, COP. @example COP */
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency debe ser un código ISO 4217 de 3 letras, p. ej. COP',
  })
  currency?: string;

  /** Precio por hora donde ninguna tarifa aplica. @example 80000 */
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_PRICE)
  basePricePerHour: number;

  /** Duración del turno en minutos: 30, 60, 90 o 120. Si se omite, 60. */
  @IsOptional()
  @IsIn(SLOT_DURATIONS)
  slotDuration?: number;

  /**
   * Código de la superficie o tipo de grama (GET /catalogs → courtSurfaces);
   * debe aplicar al deporte. null la quita. @example GRAMA_SINTETICA
   */
  @ApiProperty({ type: String, nullable: true, required: false })
  @IsOptional()
  @Matches(CATALOG_CODE_PATTERN, {
    message: 'surface debe ser un código del catálogo de superficies',
  })
  surface?: string | null;

  /** Largo en metros; va junto con widthMeters. null quita las medidas. @example 42 */
  @ApiProperty({ type: Number, nullable: true, required: false })
  @IsOptional()
  @IsNumber(METERS)
  @Min(MIN_METERS)
  @Max(MAX_METERS)
  lengthMeters?: number | null;

  /** Ancho en metros; va junto con lengthMeters. @example 25 */
  @ApiProperty({ type: Number, nullable: true, required: false })
  @IsOptional()
  @IsNumber(METERS)
  @Min(MIN_METERS)
  @Max(MAX_METERS)
  widthMeters?: number | null;

  /** Formato: jugadores por equipo (5 = fútbol 5, 2 = pádel). null lo quita. @example 5 */
  @ApiProperty({ type: Number, nullable: true, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PLAYERS_PER_SIDE)
  playersPerSide?: number | null;

  /** Los 7 días de la semana, cada uno una vez. */
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => CourtScheduleDto)
  schedules: CourtScheduleDto[];

  /** Tarifas por franja; no se pueden cruzar. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CourtRateDto)
  rates?: CourtRateDto[];
}

/** Los campos enviados reemplazan los actuales; schedules y rates reemplazan la lista completa. */
export class UpdateCourtDto extends PartialType(CreateCourtDto) {}

export class CourtSurfaceRefDto {
  /** @example GRAMA_SINTETICA */
  code: string;
  /** @example Grama sintética */
  name: string;
}

export class CourtPhotoDto {
  @ApiProperty({ enum: CourtPhotoSlot })
  slot: CourtPhotoSlot;
  url: string;
}

export class CourtDto {
  id: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  isCovered: boolean;
  isActive: boolean;
  /** Tiene las fotos MAIN, SURFACE y LIGHTING. */
  isComplete: boolean;
  /** Activa y completa: puede recibir reservas. */
  isBookable: boolean;
  @ApiProperty({ enum: CourtPhotoSlot, isArray: true })
  missingPhotos: CourtPhotoSlot[];
  currency: string;
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
