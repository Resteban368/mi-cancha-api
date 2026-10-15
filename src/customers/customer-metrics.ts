// Métricas de fidelidad de un cliente, calculadas a partir de sus reservas.
import {
  PaymentStatus,
  ReservationStatus,
  type Sport,
} from '../generated/prisma/enums.js';

export const CUSTOMER_LEVELS = ['NEW', 'RECURRENT', 'FREQUENT', 'VIP'] as const;
export type CustomerLevel = (typeof CUSTOMER_LEVELS)[number];

/** Días que un cliente cuenta como "nuevo" en el filtro desde que se registró. */
export const NEW_CUSTOMER_DAYS = 30;

export interface ReservationForMetrics {
  status: ReservationStatus;
  start: Date;
  totalPrice: number;
  courtName: string;
  sport: Sport;
  payments: { amount: number; status: PaymentStatus }[];
}

export interface CustomerMetrics {
  /** Reservas no canceladas. */
  reservations: number;
  level: CustomerLevel;
  /** Jugadas ÷ (jugadas + no asistió), en %; null si aún no hay ninguna. */
  attendancePct: number | null;
  /** Pagos aprobados (los devueltos no cuentan). */
  totalSpent: number;
  /** Lo que falta por pagar de las reservas confirmadas y jugadas. */
  balance: number;
  /** Última reserva confirmada o jugada que ya empezó. */
  lastVisit: { date: Date; courtName: string } | null;
  /** Deporte que más ha reservado. */
  mostPlayedSport: Sport | null;
}

/** Cortes: 0–1 reservas Nuevo, 2–4 Recurrente, 5–19 Frecuente, 20+ VIP. */
export function levelFor(reservations: number): CustomerLevel {
  if (reservations >= 20) return 'VIP';
  if (reservations >= 5) return 'FREQUENT';
  if (reservations >= 2) return 'RECURRENT';
  return 'NEW';
}

export function computeMetrics(
  reservations: ReservationForMetrics[],
  now = new Date(),
): CustomerMetrics {
  let count = 0;
  let completed = 0;
  let noShow = 0;
  let totalSpent = 0;
  let balance = 0;
  let lastVisit: CustomerMetrics['lastVisit'] = null;
  const sports = new Map<Sport, number>();

  for (const r of reservations) {
    const paid = r.payments
      .filter((p) => p.status === PaymentStatus.APPROVED)
      .reduce((sum, p) => sum + p.amount, 0);
    totalSpent += paid;
    if (r.status === ReservationStatus.CANCELLED) continue;

    count++;
    sports.set(r.sport, (sports.get(r.sport) ?? 0) + 1);
    if (r.status === ReservationStatus.COMPLETED) completed++;
    if (r.status === ReservationStatus.NO_SHOW) noShow++;

    const counts =
      r.status === ReservationStatus.CONFIRMED ||
      r.status === ReservationStatus.COMPLETED;
    if (counts) balance += Math.max(0, r.totalPrice - paid);
    if (counts && r.start <= now && (!lastVisit || r.start > lastVisit.date)) {
      lastVisit = { date: r.start, courtName: r.courtName };
    }
  }

  let mostPlayedSport: Sport | null = null;
  for (const [sport, n] of sports) {
    if (!mostPlayedSport || n > sports.get(mostPlayedSport)!) {
      mostPlayedSport = sport;
    }
  }

  return {
    reservations: count,
    level: levelFor(count),
    attendancePct:
      completed + noShow
        ? Math.round((completed / (completed + noShow)) * 100)
        : null,
    totalSpent: round2(totalSpent),
    balance: round2(balance),
    lastVisit,
    mostPlayedSport,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
