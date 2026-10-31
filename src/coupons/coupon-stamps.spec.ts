import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CouponCardStatus,
  PaymentStatus,
  ReservationStatus,
} from '../generated/prisma/enums.js';
import { restoreRedeemedCoupon, syncCouponStamps } from './coupon-stamps.js';

const NOW = new Date('2026-10-30T12:00:00Z');
const member = (over: object = {}) => ({
  id: 'r-1',
  status: ReservationStatus.COMPLETED,
  start: new Date('2026-10-29T20:00:00Z'),
  totalPrice: 80_000,
  consumptionsTotal: 0,
  court: { name: 'Cancha 1' },
  payments: [{ status: PaymentStatus.APPROVED, amount: 80_000 }],
  ...over,
});
const coupon = {
  id: 'c-1',
  requiredReservations: 2,
  expiresAt: null,
  maxRedemptions: null,
  redeemedCount: 0,
};

describe('syncCouponStamps', () => {
  let prisma: PrismaMock;
  const sync = () =>
    syncCouponStamps(
      prisma as unknown as Prisma.TransactionClient,
      'b-1',
      'r-1',
      NOW,
    );

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'r-1',
      groupId: null,
      customerId: 'cu-1',
    });
    prisma.reservation.findMany.mockResolvedValue([member()]);
    prisma.couponCard.findUnique.mockResolvedValue(null);
    prisma.coupon.findMany.mockResolvedValue([coupon]);
    prisma.couponStamp.findUnique.mockResolvedValue(null);
    prisma.couponStamp.findMany.mockResolvedValue([]);
    prisma.couponCard.findFirst.mockResolvedValue(null);
    prisma.couponCard.create.mockResolvedValue({ id: 'card-1' });
    prisma.couponStamp.count.mockResolvedValue(1);
  });

  it('suma una reserva jugada y pagada, abriendo la tarjeta', async () => {
    await sync();
    expect(prisma.couponCard.create).toHaveBeenCalledWith({
      data: { couponId: 'c-1', customerId: 'cu-1', cycle: 1 },
    });
    expect(prisma.couponStamp.create.mock.calls[0][0].data).toMatchObject({
      cardId: 'card-1',
      reservationKey: 'r-1',
      courts: 1,
      amount: 80_000,
    });
    expect(prisma.couponCard.update).not.toHaveBeenCalled();
  });

  it('no suma si queda saldo por pagar', async () => {
    prisma.reservation.findMany.mockResolvedValue([
      member({
        payments: [{ status: PaymentStatus.APPROVED, amount: 30_000 }],
      }),
    ]);
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('un grupo suma una sola vez, con todas sus canchas', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'r-1',
      groupId: 'g-1',
      customerId: 'cu-1',
    });
    prisma.reservation.findMany.mockResolvedValue([
      member(),
      member({
        id: 'r-2',
        court: { name: 'Cancha 2' },
        payments: [{ status: PaymentStatus.APPROVED, amount: 80_000 }],
      }),
    ]);
    await sync();
    expect(prisma.couponStamp.create).toHaveBeenCalledTimes(1);
    expect(prisma.couponStamp.create.mock.calls[0][0].data).toMatchObject({
      reservationKey: 'g-1',
      courts: 2,
      courtNames: ['Cancha 1', 'Cancha 2'],
      amount: 160_000,
    });
  });

  it('no suma dos veces la misma reserva', async () => {
    prisma.couponStamp.findUnique.mockResolvedValue({ id: 's-1' });
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('solo pide cupones creados antes de jugar la reserva', async () => {
    await sync();
    expect(prisma.coupon.findMany.mock.calls[0][0].where).toMatchObject({
      businessId: 'b-1',
      isActive: true,
      createdAt: { lte: member().start },
    });
  });

  it('al llegar a N gana el bono', async () => {
    prisma.couponStamp.count.mockResolvedValue(2);
    await sync();
    expect(prisma.couponCard.update).toHaveBeenCalledWith({
      where: { id: 'card-1' },
      data: { status: CouponCardStatus.EARNED, earnedAt: NOW },
    });
  });

  it('con un bono sin usar no acumula', async () => {
    prisma.couponCard.findFirst.mockResolvedValue({
      id: 'card-1',
      cycle: 1,
      status: CouponCardStatus.EARNED,
    });
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('un cupón vencido no suma', async () => {
    prisma.coupon.findMany.mockResolvedValue([
      { ...coupon, expiresAt: new Date('2026-10-01T00:00:00Z') },
    ]);
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('un cupón con el límite alcanzado no suma', async () => {
    prisma.coupon.findMany.mockResolvedValue([
      { ...coupon, maxRedemptions: 5, redeemedCount: 5 },
    ]);
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('la reserva con bono usado no cuenta para el siguiente', async () => {
    prisma.couponCard.findUnique.mockResolvedValue({ id: 'card-0' });
    await sync();
    expect(prisma.couponStamp.create).not.toHaveBeenCalled();
  });

  it('si deja de estar jugada quita la marca y reabre el bono', async () => {
    prisma.reservation.findMany.mockResolvedValue([
      member({ status: ReservationStatus.NO_SHOW }),
    ]);
    prisma.couponStamp.findMany.mockResolvedValue([
      { id: 's-1', cardId: 'card-1' },
    ]);
    await sync();
    expect(prisma.couponStamp.delete).toHaveBeenCalledWith({
      where: { id: 's-1' },
    });
    expect(prisma.couponCard.updateMany.mock.calls[0][0].data.status).toBe(
      CouponCardStatus.IN_PROGRESS,
    );
  });

  it('sin cliente no hace nada', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'r-1',
      groupId: null,
      customerId: null,
    });
    await sync();
    expect(prisma.coupon.findMany).not.toHaveBeenCalled();
  });

  it('al cancelar devuelve el bono y libera el cupo', async () => {
    prisma.couponCard.findUnique.mockResolvedValue({
      id: 'card-1',
      couponId: 'c-1',
    });
    await restoreRedeemedCoupon(
      prisma as unknown as Prisma.TransactionClient,
      'r-1',
    );
    expect(prisma.couponCard.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'card-1' },
      data: { status: CouponCardStatus.EARNED, redemptionKey: null },
    });
    expect(prisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { redeemedCount: { decrement: 1 } },
    });
  });
});
