import type { Prisma } from '../generated/prisma/client.js';
import {
  CouponCardStatus,
  PaymentStatus,
  ReservationStatus,
} from '../generated/prisma/enums.js';

const memberSelect = {
  id: true,
  status: true,
  start: true,
  totalPrice: true,
  consumptionsTotal: true,
  court: { select: { name: true } },
  payments: { select: { status: true, amount: true } },
} satisfies Prisma.ReservationSelect;

type Member = Prisma.ReservationGetPayload<{ select: typeof memberSelect }>;

/** Lo que aún debe la reserva (o el grupo): total + consumos - pagos aprobados. */
export function memberBalance(members: Member[]): number {
  const due = members.reduce(
    (sum, m) => sum + Number(m.totalPrice) + Number(m.consumptionsTotal),
    0,
  );
  const paid = members
    .flatMap((m) => m.payments)
    .filter((p) => p.status === PaymentStatus.APPROVED)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.round((due - paid) * 100) / 100;
}

/** El cupón ya no suma reservas ni se puede redimir por su fecha. */
export function isCouponExpired(
  coupon: { expiresAt: Date | null },
  now = new Date(),
): boolean {
  return !!coupon.expiresAt && coupon.expiresAt <= now;
}

/** Ya se redimieron todos los bonos que permite el cupón. */
export function isCouponExhausted(coupon: {
  maxRedemptions: number | null;
  redeemedCount: number;
}): boolean {
  return (
    coupon.maxRedemptions !== null &&
    coupon.redeemedCount >= coupon.maxRedemptions
  );
}

/** La reserva, sin canceladas, con todas las canchas de su grupo. */
export async function loadReservationMembers(
  tx: Prisma.TransactionClient,
  businessId: string,
  reservationId: string,
): Promise<{
  key: string;
  customerId: string | null;
  members: Member[];
} | null> {
  const reservation = await tx.reservation.findFirst({
    where: { id: reservationId, businessId },
    select: { id: true, groupId: true, customerId: true },
  });
  if (!reservation) return null;
  const members = await tx.reservation.findMany({
    where: {
      ...(reservation.groupId
        ? { groupId: reservation.groupId }
        : { id: reservation.id }),
      status: { not: ReservationStatus.CANCELLED },
    },
    select: memberSelect,
    orderBy: { createdAt: 'asc' },
  });
  return {
    key: reservation.groupId ?? reservation.id,
    customerId: reservation.customerId,
    members,
  };
}

/**
 * Pone la tarjeta del cliente al día con la reserva: suma cuando está jugada y
 * sin saldo, y quita la marca si deja de estar jugada. Se llama cada vez que
 * cambia su estado o su saldo; marcar dos veces no suma dos.
 */
export async function syncCouponStamps(
  tx: Prisma.TransactionClient,
  businessId: string,
  reservationId: string,
  now = new Date(),
): Promise<void> {
  const loaded = await loadReservationMembers(tx, businessId, reservationId);
  if (!loaded?.customerId) return;
  const { key, customerId, members } = loaded;

  const completed =
    members.length > 0 &&
    members.every((m) => m.status === ReservationStatus.COMPLETED);
  if (!completed) {
    await removeStamps(tx, key);
    return;
  }
  if (memberBalance(members) > 0) return;

  // La reserva en la que se usó un bono no cuenta para el siguiente.
  const redeemed = await tx.couponCard.findUnique({
    where: { redemptionKey: key },
    select: { id: true },
  });
  if (redeemed) return;

  const playedAt = members
    .map((m) => m.start)
    .reduce((first, start) => (start < first ? start : first));
  // Solo cuenta lo jugado desde que existe el cupón, si sigue abierto.
  const coupons = await tx.coupon.findMany({
    where: { businessId, isActive: true, createdAt: { lte: playedAt } },
  });
  for (const coupon of coupons) {
    if (isCouponExpired(coupon, now) || isCouponExhausted(coupon)) continue;
    await stampCoupon(tx, coupon, customerId, key, members, playedAt, now);
  }
}

async function stampCoupon(
  tx: Prisma.TransactionClient,
  coupon: {
    id: string;
    requiredReservations: number;
  },
  customerId: string,
  key: string,
  members: Member[],
  playedAt: Date,
  now: Date,
): Promise<void> {
  const existing = await tx.couponStamp.findUnique({
    where: {
      couponId_reservationKey: { couponId: coupon.id, reservationKey: key },
    },
    select: { id: true },
  });
  if (existing) return;

  const latest = await tx.couponCard.findFirst({
    where: { couponId: coupon.id, customerId },
    orderBy: { cycle: 'desc' },
  });
  // No acumulativo: con un bono sin usar, esta tarjeta no suma.
  if (latest?.status === CouponCardStatus.EARNED) return;

  const card =
    latest?.status === CouponCardStatus.IN_PROGRESS
      ? latest
      : await tx.couponCard.create({
          data: {
            couponId: coupon.id,
            customerId,
            cycle: (latest?.cycle ?? 0) + 1,
          },
        });

  await tx.couponStamp.create({
    data: {
      couponId: coupon.id,
      cardId: card.id,
      reservationKey: key,
      reservationId: members[0].id,
      courts: members.length,
      courtNames: members.map((m) => m.court.name),
      amount: members.reduce((sum, m) => sum + Number(m.totalPrice), 0),
      playedAt,
    },
  });

  const stamps = await tx.couponStamp.count({ where: { cardId: card.id } });
  if (stamps >= coupon.requiredReservations) {
    await tx.couponCard.update({
      where: { id: card.id },
      data: { status: CouponCardStatus.EARNED, earnedAt: now },
    });
  }
}

/** La reserva dejó de estar jugada: se quita su marca, salvo si el bono ya se usó. */
async function removeStamps(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  const stamps = await tx.couponStamp.findMany({
    where: {
      reservationKey: key,
      card: {
        status: { in: [CouponCardStatus.IN_PROGRESS, CouponCardStatus.EARNED] },
      },
    },
    select: { id: true, cardId: true },
  });
  for (const stamp of stamps) {
    await tx.couponStamp.delete({ where: { id: stamp.id } });
    await tx.couponCard.updateMany({
      where: { id: stamp.cardId, status: CouponCardStatus.EARNED },
      data: { status: CouponCardStatus.IN_PROGRESS, earnedAt: null },
    });
  }
}

/** Al cancelar la reserva en la que se usó un bono, el cliente lo recupera. */
export async function restoreRedeemedCoupon(
  tx: Prisma.TransactionClient,
  reservationKey: string,
): Promise<void> {
  const card = await tx.couponCard.findUnique({
    where: { redemptionKey: reservationKey },
    select: { id: true, couponId: true },
  });
  if (!card) return;
  await tx.couponCard.update({
    where: { id: card.id },
    data: {
      status: CouponCardStatus.EARNED,
      redeemedAt: null,
      redemptionKey: null,
      redeemedCourts: null,
      redeemedAmount: null,
    },
  });
  await tx.coupon.update({
    where: { id: card.couponId },
    data: { redeemedCount: { decrement: 1 } },
  });
}
