import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Page } from '../../common/dto/page.dto.js';
import {
  Sport,
  type PaymentConcept,
  type PaymentStatus,
  type ReservationStatus,
} from '../../generated/prisma/enums.js';
import { CUSTOMER_LEVELS, type CustomerLevel } from '../customer-metrics.js';

export const CUSTOMER_SEGMENTS = [
  'ALL',
  'LOYAL',
  'WITH_BALANCE',
  'NEW',
] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SORTS = [
  'MOST_RESERVATIONS',
  'TOP_SPENDERS',
  'LAST_VISIT',
  'HIGHEST_BALANCE',
  'NAME',
  'NEWEST',
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export class CustomerInputDto {
  /** @example Valentina Dussán */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Se guardan solo los dígitos (y el + inicial). @example 300 123 4567 */
  @Matches(/^\+?[\d\s()-]{7,20}$/, {
    message: 'phone debe ser un teléfono válido (7 a 20 dígitos)',
  })
  phone: string;

  /** Cédula u otro documento; se ignoran puntos, espacios y guiones. @example 1.117.523.456 */
  @Matches(/^[\dA-Za-z.\s-]{4,20}$/, {
    message: 'documentId debe tener entre 4 y 20 caracteres (letras o números)',
  })
  documentId: string;
}

export class CreateCustomerDto extends CustomerInputDto {
  /** Deporte habitual; si se omite se usa el que más reserva. */
  @ApiProperty({ enum: Sport, required: false, nullable: true })
  @IsOptional()
  @IsEnum(Sport)
  preferredSport?: Sport | null;

  /** Notas internas del negocio. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

/** Los campos enviados reemplazan los actuales; null borra deporte o notas. */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomerSearchDto {
  /** Nombre, teléfono o cédula. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class CustomerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  /** Texto a buscar (nombre, teléfono o cédula). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * ALL todos · LOYAL frecuentes y VIP · WITH_BALANCE con saldo por cobrar ·
   * NEW registrados en los últimos 30 días.
   */
  @ApiProperty({ enum: CUSTOMER_SEGMENTS, required: false })
  @IsOptional()
  @IsIn(CUSTOMER_SEGMENTS)
  segment?: CustomerSegment;

  /** Por defecto MOST_RESERVATIONS. */
  @ApiProperty({ enum: CUSTOMER_SORTS, required: false })
  @IsOptional()
  @IsIn(CUSTOMER_SORTS)
  sort?: CustomerSort;
}

export class CustomerDto {
  id: string;
  name: string;
  /** Con indicativo, p. ej. +573114567890. */
  phone: string;
  documentId: string;
  @ApiProperty({ enum: Sport, nullable: true })
  preferredSport: Sport | null;
  notes: string | null;
  createdAt: Date;
}

export class CustomerLastVisitDto {
  date: Date;
  courtName: string;
}

export class CustomerMetricsDto {
  /** Reservas no canceladas. */
  reservations: number;
  /** Automático: NEW (0–1), RECURRENT (2–4), FREQUENT (5–19), VIP (20+). */
  @ApiProperty({ enum: CUSTOMER_LEVELS })
  level: CustomerLevel;
  /** Jugadas ÷ (jugadas + no asistió), en %; null si aún no hay. */
  attendancePct: number | null;
  /** Pagos aprobados. */
  totalSpent: number;
  /** Saldo de reservas confirmadas y jugadas. */
  balance: number;
  lastVisit: CustomerLastVisitDto | null;
  /** preferredSport si está definido; si no, el deporte más reservado. */
  @ApiProperty({ enum: Sport, nullable: true })
  favoriteSport: Sport | null;
}

export class CustomerSummaryDto extends CustomerDto {
  metrics: CustomerMetricsDto;
}

export class CustomersOverviewDto {
  totalCustomers: number;
  newThisMonth: number;
  /** Variación de clientes nuevos frente al mes anterior, en %; null si el mes anterior fue 0. */
  newVsLastMonthPct: number | null;
  /** Clientes FREQUENT o VIP. */
  loyalCustomers: number;
  loyalPct: number;
  /** Reservas no canceladas de todos los clientes. */
  totalReservations: number;
  /** Suma de saldos por cobrar. */
  pendingBalance: number;
  currency: string;
}

export class CustomerPageDto implements Page<CustomerSummaryDto> {
  /** Resumen de toda la cartera (no depende de filtros ni página). */
  overview: CustomersOverviewDto;
  @ApiProperty({ type: [CustomerSummaryDto] })
  items: CustomerSummaryDto[];
  /** Clientes que cumplen los filtros. */
  total: number;
  page: number;
  pageSize: number;
}

export class CustomerRefundItemDto {
  id: string;
  amount: number;
  reason: string;
  createdAt: Date;
  createdBy: string | null;
}

export class CustomerPaymentItemDto {
  id: string;
  amount: number;
  method: string;
  concept: PaymentConcept;
  status: PaymentStatus;
  reference: string | null;
  note: string | null;
  rejectionReason: string | null;
  registeredByBusiness: boolean;
  receivedAt: Date;
  reservationId: string | null;
  courtName: string | null;
  reservationStart: Date | null;
  reservationEnd: Date | null;
  refund: CustomerRefundItemDto | null;
}

export class CustomerReservationItemDto {
  id: string;
  courtId: string;
  courtName: string;
  sport: Sport;
  currency: string;
  start: Date;
  end: Date;
  customerName: string;
  customerDetail: string | null;
  phone: string;
  contactNote: string | null;
  tag: string | null;
  isRecurring: boolean;
  subtotal: number;
  discount: number;
  totalPrice: number;
  status: ReservationStatus;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledByName: string | null;
  createdAt: Date;
  payments: CustomerPaymentItemDto[];
  refunds: CustomerRefundItemDto[];
}

export class CustomerStatsDto {
  totalReservations: number;
  confirmedReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  totalSpent: number;
  pendingPayments: number;
  totalRefunded: number;
}

export class CustomerDetailDto {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  documentId: string;
  @ApiProperty({ enum: Sport, nullable: true })
  preferredSport: Sport | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  metrics: CustomerMetricsDto;
  stats: CustomerStatsDto;
  reservations: CustomerReservationItemDto[];
  payments: CustomerPaymentItemDto[];
}
