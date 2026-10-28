// Consultas SQL de la cartera de clientes: las métricas, la búsqueda, el filtro,
// el orden y la página se resuelven en Postgres, así solo viaja la página pedida.
import { Prisma } from '../generated/prisma/client.js';
import { levelFor } from './customer-metrics.js';
import type { CustomerSegment, CustomerSort } from './dto/customer.dto.js';

/** Fila de un cliente con sus métricas agregadas. */
export interface CustomerMetricsRow {
  id: string;
  name: string;
  phone: string;
  documentId: string | null;
  preferredSport: string | null;
  notes: string | null;
  createdAt: Date;
  reservations: number;
  completed: number;
  noShow: number;
  totalSpent: number;
  balance: number;
  lastVisit: Date | null;
}

export interface OverviewRow {
  totalCustomers: number;
  newThisMonth: number;
  newLastMonth: number;
  loyalCustomers: number;
  totalReservations: number;
  pendingBalance: number;
  /** Clientes que cumplen búsqueda y segmento. */
  filtered: number;
}

export interface ListParams {
  businessId: string;
  now: Date;
  search?: string;
  digits?: string;
  document?: string;
  segment: CustomerSegment;
  newSince: Date;
  thisMonth: Date;
  lastMonth: Date;
}

/** Nivel FREQUENT o VIP desde estas reservas (mismos cortes que levelFor). */
const LOYAL_MIN = (() => {
  let n = 0;
  while (levelFor(n) !== 'FREQUENT') n++;
  return n;
})();

/**
 * Clientes del negocio con sus métricas. Los pagos aprobados se suman por
 * reserva antes de unirlos, para no duplicar filas.
 */
function metricsCte(p: ListParams): Prisma.Sql {
  return Prisma.sql`
    WITH paid AS (
      SELECT p."reservationId", SUM(p."amount") AS amount
      FROM "Payment" p
      WHERE p."businessId" = ${p.businessId}
        AND p."status" = 'APPROVED'
        AND p."reservationId" IS NOT NULL
      GROUP BY p."reservationId"
    ),
    -- Una reserva de varias canchas cuenta como una: se suman sus canchas y sus
    -- pagos (que van en la primera) antes de calcular el saldo.
    units AS (
      SELECT
        r."customerId",
        MIN(r."status"::text) AS status,
        MIN(r."start") AS start,
        -- Cancha y consumos: el saldo los incluye a ambos.
        SUM(r."totalPrice" + r."consumptionsTotal") AS total,
        SUM(COALESCE(paid.amount, 0)) AS paid
      FROM "Reservation" r
      LEFT JOIN paid ON paid."reservationId" = r."id"
      WHERE r."businessId" = ${p.businessId} AND r."customerId" IS NOT NULL
      GROUP BY r."customerId", COALESCE(r."groupId", r."id")
    ),
    agg AS (
      SELECT
        u."customerId",
        COUNT(*) FILTER (WHERE u.status <> 'CANCELLED') AS reservations,
        COUNT(*) FILTER (WHERE u.status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE u.status = 'NO_SHOW') AS no_show,
        COALESCE(SUM(u.paid), 0) AS total_spent,
        COALESCE(
          SUM(GREATEST(u.total - u.paid, 0))
            FILTER (WHERE u.status IN ('CONFIRMED', 'COMPLETED')),
          0
        ) AS balance,
        MAX(u.start) FILTER (
          WHERE u.status IN ('CONFIRMED', 'COMPLETED') AND u.start <= ${p.now}
        ) AS last_visit
      FROM units u
      GROUP BY u."customerId"
    ),
    m AS (
      SELECT
        c."id", c."name", c."phone", c."documentId",
        c."preferredSport"::text AS "preferredSport", c."notes", c."createdAt",
        COALESCE(agg.reservations, 0)::int AS "reservations",
        COALESCE(agg.completed, 0)::int AS "completed",
        COALESCE(agg.no_show, 0)::int AS "noShow",
        COALESCE(agg.total_spent, 0)::float8 AS "totalSpent",
        COALESCE(agg.balance, 0)::float8 AS "balance",
        agg.last_visit AS "lastVisit"
      FROM "Customer" c
      LEFT JOIN agg ON agg."customerId" = c."id"
      WHERE c."businessId" = ${p.businessId}
    )`;
}

/** Búsqueda (nombre, teléfono o cédula) y segmento; usa los índices trigram. */
function filters(p: ListParams): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (p.search) {
    const or: Prisma.Sql[] = [
      Prisma.sql`m."name" ILIKE ${likePattern(p.search)}`,
    ];
    if (p.digits) or.push(Prisma.sql`m."phone" LIKE ${likePattern(p.digits)}`);
    if (p.digits && p.document) {
      or.push(Prisma.sql`m."documentId" LIKE ${likePattern(p.document)}`);
    }
    conditions.push(Prisma.sql`(${Prisma.join(or, ' OR ')})`);
  }
  switch (p.segment) {
    case 'LOYAL':
      conditions.push(Prisma.sql`m."reservations" >= ${LOYAL_MIN}`);
      break;
    case 'WITH_BALANCE':
      conditions.push(Prisma.sql`m."balance" > 0`);
      break;
    case 'NEW':
      conditions.push(Prisma.sql`m."createdAt" >= ${p.newSince}`);
      break;
  }
  return conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/** Orden alfabético en español (la base de Neon usa C.UTF-8, que manda los acentos al final). */
const BY_NAME = Prisma.sql`m."name" COLLATE "es-x-icu" ASC`;

const ORDER_BY: Record<CustomerSort, Prisma.Sql> = {
  MOST_RESERVATIONS: Prisma.sql`m."reservations" DESC, ${BY_NAME}`,
  TOP_SPENDERS: Prisma.sql`m."totalSpent" DESC, ${BY_NAME}`,
  LAST_VISIT: Prisma.sql`m."lastVisit" DESC NULLS LAST, ${BY_NAME}`,
  HIGHEST_BALANCE: Prisma.sql`m."balance" DESC, ${BY_NAME}`,
  NAME: BY_NAME,
  NEWEST: Prisma.sql`m."createdAt" DESC, ${BY_NAME}`,
};

export function pageQuery(
  p: ListParams,
  sort: CustomerSort,
  limit: number,
  offset: number,
): Prisma.Sql {
  return Prisma.sql`${metricsCte(p)}
    SELECT m.* FROM m
    ${filters(p)}
    ORDER BY ${ORDER_BY[sort]}, m."id"
    LIMIT ${limit} OFFSET ${offset}`;
}

/** Resumen de toda la cartera y cuántos clientes cumplen los filtros. */
export function overviewQuery(p: ListParams): Prisma.Sql {
  return Prisma.sql`${metricsCte(p)}
    SELECT
      COUNT(*)::int AS "totalCustomers",
      COUNT(*) FILTER (WHERE m."createdAt" >= ${p.thisMonth})::int AS "newThisMonth",
      COUNT(*) FILTER (
        WHERE m."createdAt" >= ${p.lastMonth} AND m."createdAt" < ${p.thisMonth}
      )::int AS "newLastMonth",
      COUNT(*) FILTER (WHERE m."reservations" >= ${LOYAL_MIN})::int AS "loyalCustomers",
      COALESCE(SUM(m."reservations"), 0)::int AS "totalReservations",
      COALESCE(SUM(m."balance"), 0)::float8 AS "pendingBalance",
      (SELECT COUNT(*) FROM m ${filters(p)})::int AS "filtered"
    FROM m`;
}

/** Cancha de la última visita, solo para los clientes de la página. */
export function lastVisitCourtsQuery(
  customerIds: string[],
  now: Date,
): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT ON (r."customerId") r."customerId", co."name" AS "courtName"
    FROM "Reservation" r
    JOIN "Court" co ON co."id" = r."courtId"
    WHERE r."customerId" IN (${Prisma.join(customerIds)})
      AND r."status" IN ('CONFIRMED', 'COMPLETED')
      AND r."start" <= ${now}
    ORDER BY r."customerId", r."start" DESC`;
}

/** Reservas por deporte, solo para los clientes de la página. */
export function sportsQuery(customerIds: string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT r."customerId", co."sport"::text AS "sport",
      COUNT(DISTINCT COALESCE(r."groupId", r."id"))::int AS "count"
    FROM "Reservation" r
    JOIN "Court" co ON co."id" = r."courtId"
    WHERE r."customerId" IN (${Prisma.join(customerIds)})
      AND r."status" <> 'CANCELLED'
    GROUP BY r."customerId", co."sport"`;
}

/** %texto% con los comodines de LIKE escapados. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
