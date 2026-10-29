import { PaymentStatus } from '../generated/prisma/enums.js';

/** Parte de un pago que fue para la cancha y parte para productos. */
export interface PaymentSplit {
  court: number;
  products: number;
}

export interface SplitPayment {
  id: string;
  amount: number;
  status: PaymentStatus;
  receivedAt: Date;
  reservationId: string | null;
  saleId: string | null;
}

export interface SplitReservation {
  id: string;
  groupId: string | null;
  totalPrice: number;
  /** Consumos activos cargados al saldo (sin pago propio). */
  chargedConsumptions: number;
}

/**
 * Reparte cada pago entre cancha y productos. El pago de una venta (suelta
 * o consumo cobrado en el momento) es todo productos. En una reserva (o su
 * grupo de canchas) lo aprobado cubre primero la cancha y luego los
 * consumos cargados al saldo, en el orden en que se recibió; lo que sobre
 * queda como cancha. Los pagos no aprobados se reparten sobre lo que aún
 * falta después de los aprobados.
 */
export function splitPayments(
  payments: SplitPayment[],
  reservations: SplitReservation[],
): Map<string, PaymentSplit> {
  const result = new Map<string, PaymentSplit>();
  const accountOf = new Map(reservations.map((r) => [r.id, r.groupId ?? r.id]));
  const accounts = new Map<string, { court: number; products: number }>();
  for (const r of reservations) {
    const key = r.groupId ?? r.id;
    const account = accounts.get(key) ?? { court: 0, products: 0 };
    account.court += r.totalPrice;
    account.products += r.chargedConsumptions;
    accounts.set(key, account);
  }

  const byAccount = new Map<string, SplitPayment[]>();
  for (const p of payments) {
    if (p.saleId) {
      result.set(p.id, { court: 0, products: p.amount });
      continue;
    }
    const key = p.reservationId ? accountOf.get(p.reservationId) : undefined;
    if (!key) {
      result.set(p.id, { court: p.amount, products: 0 });
      continue;
    }
    byAccount.set(key, [...(byAccount.get(key) ?? []), p]);
  }

  for (const [key, list] of byAccount) {
    const left = { ...accounts.get(key)! };
    const ordered = [...list].sort(
      (a, b) =>
        Number(b.status === PaymentStatus.APPROVED) -
          Number(a.status === PaymentStatus.APPROVED) ||
        a.receivedAt.getTime() - b.receivedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    // Lo que falta después de los aprobados (para los demás estados).
    let afterApproved: { court: number; products: number } | null = null;
    for (const p of ordered) {
      const approved = p.status === PaymentStatus.APPROVED;
      if (!approved && !afterApproved) afterApproved = { ...left };
      const pool = approved ? left : { ...afterApproved! };
      const court = Math.min(p.amount, Math.max(pool.court, 0));
      const products = Math.min(p.amount - court, Math.max(pool.products, 0));
      if (approved) {
        left.court -= court;
        left.products -= products;
      }
      result.set(p.id, {
        court: round2(p.amount - products),
        products: round2(products),
      });
    }
  }
  return result;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
