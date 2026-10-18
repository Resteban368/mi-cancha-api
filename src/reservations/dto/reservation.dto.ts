import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CATALOG_CODE_PATTERN } from '../../catalogs/dto/catalog.dto.js';
import { PageQueryDto } from '../../common/dto/page.dto.js';
import {
  CustomerDto,
  CustomerInputDto,
} from '../../customers/dto/customer.dto.js';
import {
  PaymentConcept,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  Sport,
} from '../../generated/prisma/enums.js';

/** Máximo de turnos seguidos en una reserva. */
export const MAX_SLOTS = 5;
const MONEY = { maxDecimalPlaces: 2 };

export class DayQueryDto {
  /** Día en la zona horaria del negocio. @example 2026-10-13 */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  date: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'debe tener formato YYYY-MM-DD';

/**
 * Filtros del listado. Con `date` devuelve la agenda de ese día como lista
 * (sin paginar); sin `date`, una página `{ items, total, page, pageSize }`.
 */
export class ReservationsQueryDto extends PageQueryDto {
  /** Un día en hora del negocio. @example 2026-10-15 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: `date ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true })
  date?: string;

  /** Desde este día, inclusive. @example 2026-10-01 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: `from ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true })
  from?: string;

  /** Hasta este día, inclusive. @example 2026-10-31 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: `to ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true })
  to?: string;

  @ApiProperty({ enum: ReservationStatus, required: false })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** BUSINESS o WEB (reservas hechas por jugadores desde el link). */
  @ApiProperty({ enum: ReservationSource, required: false })
  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;
}

export class ReservationPageDto {
  @ApiProperty({ type: () => [ReservationDto] })
  items: ReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ReservationPaymentInputDto {
  /** Lo que paga al reservar; si es el total, el pago queda como TOTAL, si no como ANTICIPO. @example 50000 */
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(1_000_000_000)
  amount: number;

  /** Código del método de pago (GET /catalogs). Si se omite, EFECTIVO. @example NEQUI */
  @IsOptional()
  @Matches(CATALOG_CODE_PATTERN, { message: 'method no es un código válido' })
  method?: string;

  /** Obligatoria si el método la exige (p. ej. Nequi). @example M4829310 */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateReservationDto {
  /** Cancha elegida. Envía esto o `sport`. */
  @IsOptional()
  @IsUUID()
  courtId?: string;

  /** Cualquier cancha libre de este deporte: la API asigna la primera por nombre. Envía esto o `courtId`. */
  @ApiProperty({ enum: Sport, required: false })
  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  /** Inicio del primer turno (debe coincidir con un turno de GET …/availability). @example 2026-10-20T19:00:00-05:00 */
  @IsISO8601({ strict: true })
  start: string;

  /** Turnos seguidos a reservar (la duración sale del turno de la cancha). @example 2 */
  @IsInt()
  @Min(1)
  @Max(MAX_SLOTS)
  slots: number;

  /** Cliente existente del negocio. Envía esto o `customer`. */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Cliente nuevo (si el teléfono o la cédula ya existen, se usa el existente). */
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer?: CustomerInputDto;

  /** @example Equipo Los Halcones */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactNote?: string;

  /** @example Torneo */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  /** Se resta del valor de las tarifas. Por defecto 0. @example 10000 */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(1_000_000_000)
  discount?: number;

  /** Pago opcional al reservar (anticipo o total). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ReservationPaymentInputDto)
  payment?: ReservationPaymentInputDto;
}

/** Estados que se asignan a mano; para cancelar se usa POST …/cancel. */
const MANUAL_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
];

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: MANUAL_STATUSES })
  @IsIn(MANUAL_STATUSES, {
    message:
      'status debe ser CONFIRMED, COMPLETED o NO_SHOW; para cancelar usa POST /cancel con el motivo',
  })
  status: ReservationStatus;
}

export class CancelReservationDto {
  /** @example El cliente avisó que no puede asistir */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class AvailabilityQueryDto extends DayQueryDto {}

export class SportAvailabilityQueryDto extends DayQueryDto {
  @ApiProperty({ enum: Sport })
  @IsEnum(Sport)
  sport: Sport;
}

export class SlotDto {
  start: Date;
  end: Date;
  /** UNAVAILABLE solo en la web: aún libre, pero dentro de la anticipación mínima. */
  @ApiProperty({ enum: ['AVAILABLE', 'BOOKED', 'PAST', 'UNAVAILABLE'] })
  status: 'AVAILABLE' | 'BOOKED' | 'PAST' | 'UNAVAILABLE';
  /** Valor del turno según las tarifas. */
  price: number;
}

export class AvailabilityDto {
  date: string;
  courtId: string;
  slotDuration: number;
  currency: string;
  /** Turnos seguidos que se pueden reservar como máximo. */
  maxSlots: number;
  @ApiProperty({ type: [SlotDto] })
  slots: SlotDto[];
}

export class AvailabilityCourtDto {
  id: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  isCovered: boolean;
  /** Minutos de cada turno. */
  slotDuration: number;
  currency: string;
  /** Foto principal (MAIN). */
  photoUrl: string | null;
  /** Superficie o tipo de grama, p. ej. Grama sintética. */
  @ApiProperty({ type: String, nullable: true })
  surfaceName: string | null;
  /** Medidas en metros (las dos o ninguna). */
  @ApiProperty({ type: Number, nullable: true })
  lengthMeters: number | null;
  @ApiProperty({ type: Number, nullable: true })
  widthMeters: number | null;
  /** Jugadores por equipo (5 = fútbol 5). */
  @ApiProperty({ type: Number, nullable: true })
  playersPerSide: number | null;
}

export class CourtSlotsDto {
  court: AvailabilityCourtDto;
  /** Turnos AVAILABLE del día. */
  availableCount: number;
  @ApiProperty({ type: [SlotDto] })
  slots: SlotDto[];
}

export class SportAvailabilityDto {
  date: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  maxSlots: number;
  /** Una por cancha activa y con sus fotos, ordenadas por nombre. */
  @ApiProperty({ type: [CourtSlotsDto] })
  courts: CourtSlotsDto[];
}

export class ReservationPaymentDto {
  id: string;
  amount: number;
  method: string;
  @ApiProperty({ enum: PaymentConcept })
  concept: PaymentConcept;
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;
  reference: string | null;
  receivedAt: Date;
}

export class ReservationDto {
  id: string;
  courtId: string;
  courtName: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  start: Date;
  end: Date;
  /** null en reservas anteriores a la tabla de clientes. */
  customer: CustomerDto | null;
  customerName: string;
  customerDetail: string | null;
  phone: string;
  contactNote: string | null;
  tag: string | null;
  isRecurring: boolean;
  /** Valor según las tarifas. */
  subtotal: number;
  discount: number;
  /** subtotal - discount. */
  totalPrice: number;
  /** Código ISO 4217, p. ej. COP. */
  currency: string;
  /** Suma de los pagos aprobados. */
  amountPaid: number;
  /** totalPrice - amountPaid. */
  balance: number;
  @ApiProperty({ type: [ReservationPaymentDto] })
  payments: ReservationPaymentDto[];
  @ApiProperty({ enum: ReservationStatus })
  status: ReservationStatus;
  /** BUSINESS (negocio o super admin) o WEB (jugador desde el link de reservas). */
  @ApiProperty({ enum: ReservationSource })
  source: ReservationSource;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  /** Nombre de quien canceló. */
  cancelledBy: string | null;
}
