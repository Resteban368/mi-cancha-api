import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { DayOfWeek, Sport } from '../../generated/prisma/enums.js';

export const DASHBOARD_PERIODS = [
  'TODAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'CUSTOM',
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class BusinessDashboardQueryDto {
  /** Por defecto TODAY. Con CUSTOM, `from` y `to` son obligatorios (máx. 366 días). */
  @ApiProperty({ enum: DASHBOARD_PERIODS, required: false })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period?: DashboardPeriod;

  /** Primer día, inclusive (YYYY-MM-DD, hora del negocio). Solo con CUSTOM. */
  @ValidateIf((q: BusinessDashboardQueryDto) => q.period === 'CUSTOM')
  @Matches(DATE_PATTERN, { message: 'from debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  from?: string;

  /** Último día, inclusive. Solo con CUSTOM. */
  @ValidateIf((q: BusinessDashboardQueryDto) => q.period === 'CUSTOM')
  @Matches(DATE_PATTERN, { message: 'to debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  to?: string;

  /** Solo canchas de este deporte. */
  @ApiProperty({ enum: Sport, required: false })
  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  /** Solo esta cancha. */
  @IsOptional()
  @IsUUID()
  courtId?: string;
}

export class DashboardPeriodDto {
  @ApiProperty({ enum: DASHBOARD_PERIODS })
  type: DashboardPeriod;
  from: string;
  to: string;
  days: number;
  /** Período anterior de la misma duración, para comparar. */
  previousFrom: string;
  previousTo: string;
}

/** Valor del período, el del anterior y la variación en % (null si el anterior fue 0). */
export class TrendDto {
  value: number;
  previous: number;
  changePct: number | null;
}

export class DashboardSummaryDto {
  /** Reservas que empiezan en el período (todas, incluidas canceladas). */
  reservations: TrendDto;
  confirmed: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** Pagos aprobados recibidos en el período. */
  collected: TrendDto;
  /** Valor de las reservas confirmadas y jugadas del período. */
  booked: number;
  /** Lo que falta por cobrar de esas reservas. */
  pendingBalance: number;
  /** Pagos por validar hoy (no depende del período). */
  pendingPayments: { count: number; amount: number };
  /** Horas reservadas ÷ horas abiertas, en %. */
  occupancyPct: TrendDto;
  bookedHours: number;
  openHours: number;
  /** booked ÷ reservas confirmadas y jugadas. */
  averageTicket: number;
  newCustomers: TrendDto;
  /** Canceladas ÷ total, en %. */
  cancellationRate: number;
  /** No asistió ÷ total, en %. */
  noShowRate: number;
  /** Descuentos de las reservas confirmadas y jugadas. */
  discounts: number;
  /** Devoluciones hechas en el período. */
  refunds: { count: number; amount: number };
}

export class CourtOccupancyDto {
  courtId: string;
  name: string;
  @ApiProperty({ enum: Sport })
  sport: Sport;
  reservations: number;
  bookedHours: number;
  openHours: number;
  occupancyPct: number;
  /** Valor de sus reservas confirmadas y jugadas. */
  booked: number;
}

export class WeekdayDto {
  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek: DayOfWeek;
  reservations: number;
  booked: number;
}

export class HeatmapCellDto {
  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek: DayOfWeek;
  /** Hora local de inicio, 0–23. */
  hour: number;
  reservations: number;
}

export class TopCustomerDto {
  id: string;
  name: string;
  phone: string;
  reservations: number;
  /** Pagos aprobados de esas reservas. */
  paid: number;
}

export class PaymentMethodStatDto {
  code: string;
  name: string;
  count: number;
  amount: number;
  /** % del total cobrado. */
  pct: number;
}

export class SportStatDto {
  @ApiProperty({ enum: Sport })
  sport: Sport;
  reservations: number;
  booked: number;
}

export class TopProductDto {
  /** null si el producto ya no existe. */
  productId: string | null;
  name: string;
  units: number;
  amount: number;
}

export class SalesDayDto {
  /** YYYY-MM-DD, hora del negocio. */
  date: string;
  walkIn: number;
  consumptions: number;
}

/** Ventas de productos del período (sin las anuladas), por fecha de la venta. */
export class DashboardSalesDto {
  /** Ventas sueltas + consumos cargados a reservas. */
  total: TrendDto;
  /** Ventas sueltas (cobradas en el momento). */
  walkIn: number;
  /** Consumos cargados a reservas (se cobran con la reserva). */
  consumptions: number;
  count: number;
  units: number;
  /** Consumos ÷ reservas confirmadas y jugadas que empiezan en el período. */
  averageConsumption: number;
  /** Parte del saldo pendiente que son consumos (los pagos cubren primero la cancha). */
  pendingConsumptions: number;
  /** Los 5 que más dinero dejaron. */
  @ApiProperty({ type: [TopProductDto] })
  topProducts: TopProductDto[];
  /** Todos los días del período, de más antiguo a más nuevo. */
  @ApiProperty({ type: [SalesDayDto] })
  byDay: SalesDayDto[];
}

export class BusinessDashboardDto {
  period: DashboardPeriodDto;
  currency: string;
  summary: DashboardSummaryDto;
  @ApiProperty({ type: [CourtOccupancyDto] })
  occupancyByCourt: CourtOccupancyDto[];
  /** Siempre los 7 días, de lunes a domingo. */
  @ApiProperty({ type: [WeekdayDto] })
  byWeekday: WeekdayDto[];
  /** Solo las celdas con reservas. */
  @ApiProperty({ type: [HeatmapCellDto] })
  heatmap: HeatmapCellDto[];
  heatmapMax: number;
  @ApiProperty({ type: [TopCustomerDto] })
  topCustomers: TopCustomerDto[];
  @ApiProperty({ type: [PaymentMethodStatDto] })
  paymentMethods: PaymentMethodStatDto[];
  @ApiProperty({ type: [SportStatDto] })
  bySport: SportStatDto[];
  /** Con filtro de deporte o cancha solo cuentan los consumos de esas canchas. */
  sales: DashboardSalesDto;
}
