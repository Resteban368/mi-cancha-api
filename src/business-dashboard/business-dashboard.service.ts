import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dayRange } from '../common/utils/day-range.js';
import { DAYS, localDate, toMinutes } from '../courts/court-time.js';
import { Prisma } from '../generated/prisma/client.js';
import type { DayOfWeek, Sport } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BusinessDashboardDto,
  BusinessDashboardQueryDto,
  DashboardPeriodDto,
  TrendDto,
} from './dto/business-dashboard.dto.js';

/** Un rango personalizado no puede superar un año. */
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Range {
  from: Date;
  to: Date;
}

interface Filter {
  sport?: Sport;
  courtId?: string;
}

/** Reservas que ocupan la cancha y cuentan como valor reservado. */
const ACTIVE = Prisma.sql`r."status" IN ('CONFIRMED', 'COMPLETED')`;
const UNIT_ACTIVE = Prisma.sql`u.status IN ('CONFIRMED', 'COMPLETED')`;

@Injectable()
export class BusinessDashboardService {
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  async getDashboard(
    businessId: string,
    query: BusinessDashboardQueryDto,
    now = new Date(),
  ): Promise<BusinessDashboardDto> {
    const period = this.resolvePeriod(query, now);
    const current = this.range(period.from, period.to);
    const previous = this.range(period.previousFrom, period.previousTo);
    const filter: Filter = { sport: query.sport, courtId: query.courtId };

    const [
      counts,
      previousCounts,
      methods,
      previousMethods,
      pending,
      courtHours,
      previousCourtHours,
      courts,
      timeCells,
      topCustomers,
      sports,
      newCustomers,
      previousNewCustomers,
      refunds,
    ] = await Promise.all([
      this.reservationCounts(businessId, current, filter),
      this.reservationCounts(businessId, previous, filter),
      this.paymentsByMethod(businessId, current, filter),
      this.paymentsByMethod(businessId, previous, filter),
      this.pendingPayments(businessId, filter),
      this.courtHours(businessId, current, filter),
      this.courtHours(businessId, previous, filter),
      this.prisma.court.findMany({
        where: {
          businessId,
          isActive: true,
          sport: filter.sport,
          id: filter.courtId,
        },
        select: {
          id: true,
          name: true,
          sport: true,
          currency: true,
          schedules: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.timeCells(businessId, current, filter),
      this.topCustomers(businessId, current, filter),
      this.bySport(businessId, current, filter),
      this.prisma.customer.count({
        where: { businessId, createdAt: { gte: current.from, lt: current.to } },
      }),
      this.prisma.customer.count({
        where: {
          businessId,
          createdAt: { gte: previous.from, lt: previous.to },
        },
      }),
      this.refunds(businessId, current, filter),
    ]);

    // Ocupación: horas reservadas sobre las horas abiertas de las canchas activas.
    const openHoursByCourt = (dates: string[]) =>
      new Map(courts.map((c) => [c.id, openHours(c.schedules, dates)]));
    const currentOpen = openHoursByCourt(datesBetween(period.from, period.to));
    const previousOpen = openHoursByCourt(
      datesBetween(period.previousFrom, period.previousTo),
    );
    const hoursOf = (rows: CourtHoursRow[], ids: Set<string>) =>
      rows.filter((r) => ids.has(r.courtId)).reduce((s, r) => s + r.hours, 0);
    const courtIds = new Set(courts.map((c) => c.id));
    const bookedHours = hoursOf(courtHours, courtIds);
    const openTotal = sum([...currentOpen.values()]);
    const previousBookedHours = hoursOf(previousCourtHours, courtIds);
    const previousOpenTotal = sum([...previousOpen.values()]);

    const collected = sum(methods.map((m) => m.amount));
    const activeReservations = counts.confirmed + counts.completed;
    const byWeekday = DAYS.map((day, i) => {
      const cells = timeCells.filter((c) => c.isoDow === i + 1);
      return {
        dayOfWeek: day,
        reservations: sum(cells.map((c) => c.reservations)),
        booked: round2(sum(cells.map((c) => c.booked))),
      };
    });
    const heatmap = timeCells.map((c) => ({
      dayOfWeek: DAYS[c.isoDow - 1] as DayOfWeek,
      hour: c.hour,
      reservations: c.reservations,
    }));

    return {
      period,
      currency: courts[0]?.currency ?? 'COP',
      summary: {
        reservations: trend(counts.total, previousCounts.total),
        confirmed: counts.confirmed,
        completed: counts.completed,
        noShow: counts.noShow,
        cancelled: counts.cancelled,
        collected: trend(
          round2(collected),
          round2(sum(previousMethods.map((m) => m.amount))),
        ),
        booked: round2(counts.booked),
        pendingBalance: round2(counts.pendingBalance),
        pendingPayments: {
          count: pending.count,
          amount: round2(pending.amount),
        },
        occupancyPct: trend(
          pct(bookedHours, openTotal),
          pct(previousBookedHours, previousOpenTotal),
        ),
        bookedHours: round2(bookedHours),
        openHours: round2(openTotal),
        averageTicket: activeReservations
          ? round2(counts.booked / activeReservations)
          : 0,
        newCustomers: trend(newCustomers, previousNewCustomers),
        cancellationRate: pct(counts.cancelled, counts.total),
        noShowRate: pct(counts.noShow, counts.total),
        discounts: round2(counts.discounts),
        refunds: { count: refunds.count, amount: round2(refunds.amount) },
      },
      occupancyByCourt: courts.map((c) => {
        const row = courtHours.find((r) => r.courtId === c.id);
        const open = currentOpen.get(c.id) ?? 0;
        return {
          courtId: c.id,
          name: c.name,
          sport: c.sport,
          reservations: row?.reservations ?? 0,
          bookedHours: round2(row?.hours ?? 0),
          openHours: round2(open),
          occupancyPct: pct(row?.hours ?? 0, open),
          booked: round2(row?.booked ?? 0),
        };
      }),
      byWeekday,
      heatmap,
      heatmapMax: Math.max(0, ...heatmap.map((c) => c.reservations)),
      topCustomers: topCustomers.map((c) => ({ ...c, paid: round2(c.paid) })),
      paymentMethods: methods.map((m) => ({
        code: m.code,
        name: m.name,
        count: m.count,
        amount: round2(m.amount),
        pct: pct(m.amount, collected),
      })),
      bySport: sports.map((s) => ({ ...s, booked: round2(s.booked) })),
    };
  }

  /** Fechas del período en hora del negocio y las del período anterior. */
  resolvePeriod(
    query: BusinessDashboardQueryDto,
    now: Date,
  ): DashboardPeriodDto {
    const today = localDate(now, this.utcOffset);
    const type = query.period ?? 'TODAY';
    let from = today;
    let to = today;
    switch (type) {
      case 'LAST_7_DAYS':
        from = addDays(today, -6);
        break;
      case 'LAST_30_DAYS':
        from = addDays(today, -29);
        break;
      case 'THIS_MONTH':
        from = `${today.slice(0, 7)}-01`;
        break;
      case 'CUSTOM':
        from = query.from!;
        to = query.to!;
        if (from > to) {
          throw new BadRequestException('from no puede ser posterior a to');
        }
        break;
    }
    const days = daysBetween(from, to) + 1;
    if (days > MAX_DAYS) {
      throw new BadRequestException(
        `El período no puede superar ${MAX_DAYS} días`,
      );
    }
    return {
      type,
      from,
      to,
      days,
      previousFrom: addDays(from, -days),
      previousTo: addDays(from, -1),
    };
  }

  private range(from: string, to: string): Range {
    return {
      from: dayRange(from, this.utcOffset).from,
      to: dayRange(to, this.utcOffset).to,
    };
  }

  private reservationCounts(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<ReservationCounts> {
    return this.prisma
      .$queryRaw<ReservationCounts[]>(
        Prisma.sql`
        WITH paid AS (
          SELECT p."reservationId", SUM(p."amount") AS amount
          FROM "Payment" p
          WHERE p."businessId" = ${businessId} AND p."status" = 'APPROVED'
            AND p."reservationId" IS NOT NULL
          GROUP BY p."reservationId"
        ),
        -- Una reserva de varias canchas cuenta como una; sus pagos van en la primera.
        units AS (
          SELECT
            MIN(r."status"::text) AS status,
            SUM(r."totalPrice") AS total,
            SUM(r."consumptionsTotal") AS consumptions,
            SUM(r."discount") AS discount,
            SUM(COALESCE(paid.amount, 0)) AS paid
          FROM "Reservation" r
          JOIN "Court" co ON co."id" = r."courtId"
          LEFT JOIN paid ON paid."reservationId" = r."id"
          WHERE r."businessId" = ${businessId}
            AND r."start" >= ${range.from} AND r."start" < ${range.to}
            ${courtFilter(filter)}
          GROUP BY COALESCE(r."groupId", r."id")
        )
        SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE u.status = 'CONFIRMED')::int AS "confirmed",
          COUNT(*) FILTER (WHERE u.status = 'COMPLETED')::int AS "completed",
          COUNT(*) FILTER (WHERE u.status = 'NO_SHOW')::int AS "noShow",
          COUNT(*) FILTER (WHERE u.status = 'CANCELLED')::int AS "cancelled",
          COALESCE(SUM(u.total) FILTER (WHERE ${UNIT_ACTIVE}), 0)::float8 AS "booked",
          COALESCE(SUM(u.discount) FILTER (WHERE ${UNIT_ACTIVE}), 0)::float8 AS "discounts",
          COALESCE(
            SUM(GREATEST(u.total + u.consumptions - u.paid, 0)) FILTER (WHERE ${UNIT_ACTIVE}),
            0
          )::float8 AS "pendingBalance"
        FROM units u`,
      )
      .then((rows) => rows[0]);
  }

  /** Pagos aprobados recibidos en el rango, por método (de mayor a menor monto). */
  private paymentsByMethod(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<MethodRow[]> {
    return this.prisma.$queryRaw<MethodRow[]>(Prisma.sql`
      SELECT pm."code", pm."name", COUNT(*)::int AS "count",
        SUM(p."amount")::float8 AS "amount"
      FROM "Payment" p
      JOIN "PaymentMethod" pm ON pm."id" = p."methodId"
      LEFT JOIN "Reservation" r ON r."id" = p."reservationId"
      LEFT JOIN "Court" co ON co."id" = r."courtId"
      WHERE p."businessId" = ${businessId} AND p."status" = 'APPROVED'
        AND p."receivedAt" >= ${range.from} AND p."receivedAt" < ${range.to}
        ${courtFilter(filter)}
      GROUP BY pm."code", pm."name"
      ORDER BY "amount" DESC, pm."name"`);
  }

  private pendingPayments(
    businessId: string,
    filter: Filter,
  ): Promise<{ count: number; amount: number }> {
    return this.prisma
      .$queryRaw<{ count: number; amount: number }[]>(
        Prisma.sql`
        SELECT COUNT(*)::int AS "count", COALESCE(SUM(p."amount"), 0)::float8 AS "amount"
        FROM "Payment" p
        LEFT JOIN "Reservation" r ON r."id" = p."reservationId"
        LEFT JOIN "Court" co ON co."id" = r."courtId"
        WHERE p."businessId" = ${businessId} AND p."status" = 'PENDING'
          ${courtFilter(filter)}`,
      )
      .then((rows) => rows[0]);
  }

  /** Por cancha: reservas activas que empiezan en el rango, sus horas y su valor. */
  private courtHours(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<CourtHoursRow[]> {
    return this.prisma.$queryRaw<CourtHoursRow[]>(Prisma.sql`
      SELECT r."courtId", COUNT(*)::int AS "reservations",
        (SUM(EXTRACT(EPOCH FROM (LEAST(r."end", ${range.to}) - r."start"))) / 3600)::float8 AS "hours",
        SUM(r."totalPrice")::float8 AS "booked"
      FROM "Reservation" r
      JOIN "Court" co ON co."id" = r."courtId"
      WHERE r."businessId" = ${businessId} AND ${ACTIVE}
        AND r."start" >= ${range.from} AND r."start" < ${range.to}
        ${courtFilter(filter)}
      GROUP BY r."courtId"`);
  }

  /** Reservas no canceladas por día de la semana (ISO, 1 = lunes) y hora local de inicio. */
  private timeCells(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<TimeCellRow[]> {
    const offset = offsetMinutes(this.utcOffset);
    return this.prisma.$queryRaw<TimeCellRow[]>(Prisma.sql`
      SELECT
        EXTRACT(ISODOW FROM r."start" + make_interval(mins => ${offset}))::int AS "isoDow",
        EXTRACT(HOUR FROM r."start" + make_interval(mins => ${offset}))::int AS "hour",
        COUNT(*)::int AS "reservations",
        COALESCE(SUM(r."totalPrice") FILTER (WHERE ${ACTIVE}), 0)::float8 AS "booked"
      FROM "Reservation" r
      JOIN "Court" co ON co."id" = r."courtId"
      WHERE r."businessId" = ${businessId} AND r."status" <> 'CANCELLED'
        AND r."start" >= ${range.from} AND r."start" < ${range.to}
        ${courtFilter(filter)}
      GROUP BY 1, 2
      ORDER BY 1, 2`);
  }

  private topCustomers(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<
    {
      id: string;
      name: string;
      phone: string;
      reservations: number;
      paid: number;
    }[]
  > {
    return this.prisma.$queryRaw(Prisma.sql`
      WITH paid AS (
        SELECT p."reservationId", SUM(p."amount") AS amount
        FROM "Payment" p
        WHERE p."businessId" = ${businessId} AND p."status" = 'APPROVED'
          AND p."reservationId" IS NOT NULL
        GROUP BY p."reservationId"
      )
      SELECT c."id", c."name", c."phone",
        COUNT(DISTINCT COALESCE(r."groupId", r."id"))::int AS "reservations",
        COALESCE(SUM(paid.amount), 0)::float8 AS "paid"
      FROM "Reservation" r
      JOIN "Customer" c ON c."id" = r."customerId"
      JOIN "Court" co ON co."id" = r."courtId"
      LEFT JOIN paid ON paid."reservationId" = r."id"
      WHERE r."businessId" = ${businessId} AND r."status" <> 'CANCELLED'
        AND r."start" >= ${range.from} AND r."start" < ${range.to}
        ${courtFilter(filter)}
      GROUP BY c."id", c."name", c."phone"
      ORDER BY "reservations" DESC, "paid" DESC, c."name" COLLATE "es-x-icu"
      LIMIT 5`);
  }

  private bySport(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<{ sport: Sport; reservations: number; booked: number }[]> {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT co."sport"::text AS "sport",
        COUNT(DISTINCT COALESCE(r."groupId", r."id"))::int AS "reservations",
        COALESCE(SUM(r."totalPrice") FILTER (WHERE ${ACTIVE}), 0)::float8 AS "booked"
      FROM "Reservation" r
      JOIN "Court" co ON co."id" = r."courtId"
      WHERE r."businessId" = ${businessId} AND r."status" <> 'CANCELLED'
        AND r."start" >= ${range.from} AND r."start" < ${range.to}
        ${courtFilter(filter)}
      GROUP BY co."sport"
      ORDER BY "reservations" DESC`);
  }

  private refunds(
    businessId: string,
    range: Range,
    filter: Filter,
  ): Promise<{ count: number; amount: number }> {
    return this.prisma
      .$queryRaw<{ count: number; amount: number }[]>(
        Prisma.sql`
        SELECT COUNT(*)::int AS "count", COALESCE(SUM(rf."amount"), 0)::float8 AS "amount"
        FROM "Refund" rf
        JOIN "Reservation" r ON r."id" = rf."reservationId"
        JOIN "Court" co ON co."id" = r."courtId"
        WHERE rf."businessId" = ${businessId}
          AND rf."createdAt" >= ${range.from} AND rf."createdAt" < ${range.to}
          ${courtFilter(filter)}`,
      )
      .then((rows) => rows[0]);
  }
}

interface ReservationCounts {
  total: number;
  confirmed: number;
  completed: number;
  noShow: number;
  cancelled: number;
  booked: number;
  discounts: number;
  pendingBalance: number;
}

interface MethodRow {
  code: string;
  name: string;
  count: number;
  amount: number;
}

interface CourtHoursRow {
  courtId: string;
  reservations: number;
  hours: number;
  booked: number;
}

interface TimeCellRow {
  isoDow: number;
  hour: number;
  reservations: number;
  booked: number;
}

/** Filtro opcional por deporte o cancha sobre el alias `co`. */
function courtFilter(filter: Filter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filter.sport)
    conditions.push(Prisma.sql`co."sport"::text = ${filter.sport}`);
  if (filter.courtId) conditions.push(Prisma.sql`co."id" = ${filter.courtId}`);
  return conditions.length
    ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/** Horas abiertas de una cancha en esas fechas, según su horario semanal. */
export function openHours(
  schedules: {
    dayOfWeek: DayOfWeek;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }[],
  dates: string[],
): number {
  let minutes = 0;
  for (const date of dates) {
    const day = DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const s = schedules.find((x) => x.dayOfWeek === day);
    if (!s?.isOpen || !s.openTime || !s.closeTime) continue;
    const span =
      (toMinutes(s.closeTime) - toMinutes(s.openTime) + 1440) % 1440 || 1440;
    minutes += span;
  }
  return minutes / 60;
}

function trend(value: number, previous: number): TrendDto {
  return {
    value,
    previous,
    changePct: previous
      ? Math.round(((value - previous) / previous) * 100)
      : null,
  };
}

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() -
      new Date(`${from}T12:00:00Z`).getTime()) /
      DAY_MS,
  );
}

function datesBetween(from: string, to: string): string[] {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) =>
    addDays(from, i),
  );
}

function offsetMinutes(utcOffset: string): number {
  const sign = utcOffset.startsWith('-') ? -1 : 1;
  return sign * toMinutes(utcOffset.slice(1));
}
