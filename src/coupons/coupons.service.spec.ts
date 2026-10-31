import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock.js';
import {
  CouponCardStatus,
  CouponRewardType,
  ReservationStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponsService } from './coupons.service.js';

const NOW = new Date('2026-10-30T12:00:00Z');
const member = (id: string) => ({
  id,
  status: ReservationStatus.CONFIRMED,
  start: new Date('2026-10-30T20:00:00Z'),
  totalPrice: 160_000,
  consumptionsTotal: 10_000,
  court: { name: id },
  payments: [],
});
const duration = (id: string) => ({
  id,
  start: new Date('2026-10-30T20:00:00Z'),
  end: new Date('2026-10-30T22:00:00Z'),
  subtotal: 160_000,
  court: { slotDuration: 60 },
});
const card = (over: object = {}) => ({
  id: 'card-1',
  status: CouponCardStatus.EARNED,
  couponId: 'c-1',
  coupon: {
    rewardType: CouponRewardType.FREE_COURT,
    percent: null,
    expiresAt: null,
    maxRedemptions: null,
  },
  ...over,
});

describe('CouponsService.redeem', () => {
  let service: CouponsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '-05:00', get: () => undefined },
        },
      ],
    }).compile();
    service = moduleRef.get(CouponsService);

    prisma.reservation.findFirst.mockResolvedValue({
      id: 'r-1',
      groupId: 'g-1',
      customerId: 'cu-1',
    });
    prisma.reservation.findMany
      .mockResolvedValueOnce([member('r-1'), member('r-2')])
      .mockResolvedValueOnce([duration('r-1'), duration('r-2')]);
    prisma.couponCard.findFirst.mockResolvedValue(card());
    prisma.couponCard.findUnique.mockResolvedValue(null);
    prisma.couponCard.updateMany.mockResolvedValue({ count: 1 });
    prisma.coupon.updateMany.mockResolvedValue({ count: 1 });
  });

  const redeem = (courts?: number) =>
    service.redeem('b-1', 'r-1', { cardId: 'card-1', courts }, NOW);

  it('cancha gratis: descuenta un turno de las canchas que decide el negocio', async () => {
    const result = await redeem(1);
    expect(result).toEqual({
      cardId: 'card-1',
      amount: 80_000,
      courts: 1,
      balance: 260_000,
    });
    expect(prisma.reservation.update).toHaveBeenCalledTimes(1);
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'r-1' },
      data: {
        discount: { increment: 80_000 },
        totalPrice: { decrement: 80_000 },
      },
    });
  });

  it('sin indicar canchas regala las de toda la reserva, y no los consumos', async () => {
    const result = await redeem();
    expect(result.amount).toBe(160_000);
    expect(result.courts).toBe(2);
    expect(result.balance).toBe(180_000);
  });

  it('no regala más canchas de las que tiene la reserva', async () => {
    await expect(redeem(3)).rejects.toThrow(BadRequestException);
  });

  it('porcentaje: aplica al valor de las canchas', async () => {
    prisma.couponCard.findFirst.mockResolvedValue(
      card({
        coupon: {
          rewardType: CouponRewardType.PERCENT,
          percent: 25,
          expiresAt: null,
          maxRedemptions: null,
        },
      }),
    );
    const result = await redeem();
    expect(result.amount).toBe(80_000);
    expect(result.courts).toBeNull();
  });

  it('rechaza un cupón vencido, aunque el bono ya esté ganado', async () => {
    prisma.couponCard.findFirst.mockResolvedValue(
      card({
        coupon: {
          rewardType: CouponRewardType.FREE_COURT,
          percent: null,
          expiresAt: new Date('2026-10-01T00:00:00Z'),
          maxRedemptions: null,
        },
      }),
    );
    await expect(redeem()).rejects.toThrow('venció');
  });

  it('rechaza si el cupón alcanzó su límite', async () => {
    prisma.coupon.updateMany.mockResolvedValue({ count: 0 });
    await expect(redeem()).rejects.toThrow('límite');
    expect(prisma.couponCard.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza una segunda redención en la misma reserva', async () => {
    prisma.couponCard.findUnique.mockResolvedValue({ id: 'other' });
    await expect(redeem()).rejects.toThrow(ConflictException);
  });

  it('rechaza si los pagos ya superan el valor con el bono', async () => {
    prisma.reservation.findMany
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...member('r-1'),
          payments: [{ status: 'APPROVED', amount: 100_000 }],
        },
      ])
      .mockResolvedValueOnce([duration('r-1')]);
    await expect(redeem()).rejects.toThrow(ConflictException);
    expect(prisma.couponCard.updateMany).not.toHaveBeenCalled();
  });
});

describe('CouponsService: vistas del jugador', () => {
  const NOW = new Date('2026-10-30T12:00:00Z');
  let service: CouponsService;
  let prisma: PrismaMock;
  const coupon = (over: object = {}) => ({
    id: 'c-1',
    name: 'Frecuente',
    requiredReservations: 10,
    rewardType: CouponRewardType.FREE_COURT,
    percent: null,
    rewardDescription: 'Una hora gratis',
    expiresAt: null,
    maxRedemptions: null,
    redeemedCount: 0,
    isActive: true,
    createdAt: NOW,
    ...over,
  });
  const card = (
    status: CouponCardStatus,
    stamps: number,
    over: object = {},
  ) => ({
    id: 'card-1',
    couponId: 'c-1',
    status,
    earnedAt: null,
    stamps: Array.from({ length: stamps }, () => ({
      reservationId: 'r',
      playedAt: NOW,
      createdAt: NOW,
      courts: 1,
      courtNames: ['A'],
      amount: 1,
    })),
    coupon: coupon(over),
  });
  const player = (cards: object[]) =>
    prisma.customer.findMany.mockResolvedValue([
      { business: { name: 'Sede', slug: 'sede' }, couponCards: cards },
    ]);

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '-05:00', get: () => undefined },
        },
      ],
    }).compile();
    service = moduleRef.get(CouponsService);
  });

  it('muestra cuántas reservas le faltan', async () => {
    player([card(CouponCardStatus.IN_PROGRESS, 7)]);
    const [row] = await service.forPlayer('u-1', NOW);
    expect(row).toMatchObject({ completed: 7, required: 10, remaining: 3 });
    expect(row.stamps).toHaveLength(7);
    expect(row.stamps[0]).toEqual({ playedAt: NOW });
  });

  it('cuenta los bonos que ya usó el jugador', async () => {
    prisma.couponCard.count.mockResolvedValue(4);
    await expect(service.summaryForPlayer('u-1')).resolves.toEqual({
      redeemed: 4,
    });
    expect(prisma.couponCard.count.mock.calls[0][0].where).toEqual({
      status: CouponCardStatus.REDEEMED,
      customer: { userId: 'u-1' },
    });
  });

  it('un bono ganado no le deja reservas por llenar', async () => {
    player([card(CouponCardStatus.EARNED, 10)]);
    const [row] = await service.forPlayer('u-1', NOW);
    expect(row).toMatchObject({ status: 'EARNED', remaining: 0 });
  });

  it('en un cupón pausado solo ve el bono ya ganado', async () => {
    player([card(CouponCardStatus.IN_PROGRESS, 7, { isActive: false })]);
    await expect(service.forPlayer('u-1', NOW)).resolves.toEqual([]);
    player([card(CouponCardStatus.EARNED, 10, { isActive: false })]);
    await expect(service.forPlayer('u-1', NOW)).resolves.toHaveLength(1);
  });

  it('oculta los cupones vencidos, agotados y las tarjetas redimidas', async () => {
    player([
      card(CouponCardStatus.EARNED, 10, {
        expiresAt: new Date('2026-10-01T00:00:00Z'),
      }),
    ]);
    await expect(service.forPlayer('u-1', NOW)).resolves.toEqual([]);
    player([
      card(CouponCardStatus.EARNED, 10, {
        maxRedemptions: 1,
        redeemedCount: 1,
      }),
    ]);
    await expect(service.forPlayer('u-1', NOW)).resolves.toEqual([]);
    player([card(CouponCardStatus.REDEEMED, 10)]);
    await expect(service.forPlayer('u-1', NOW)).resolves.toEqual([]);
  });

  it('la página del negocio no ofrece cupones agotados ni expone el conteo', async () => {
    prisma.business.findUnique.mockResolvedValue({
      coupons: [
        coupon(),
        coupon({ id: 'c-2', maxRedemptions: 2, redeemedCount: 2 }),
      ],
    });
    const rows = await service.publicForBusiness('sede', NOW);
    expect(rows.map((r) => r.id)).toEqual(['c-1']);
    expect(rows[0]).not.toHaveProperty('redeemedCount');
  });
});

describe('CouponsService.remove', () => {
  let service: CouponsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '-05:00', get: () => undefined },
        },
      ],
    }).compile();
    service = moduleRef.get(CouponsService);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'c-1',
      imagePath: 'coupons/c-1/a.jpg',
    });
  });

  it('borra un cupón sin bonos y devuelve su imagen', async () => {
    prisma.couponCard.count.mockResolvedValue(0);
    await expect(service.remove('b-1', 'c-1')).resolves.toBe(
      'coupons/c-1/a.jpg',
    );
    expect(prisma.couponCard.count).toHaveBeenCalledWith({
      where: {
        couponId: 'c-1',
        status: { in: [CouponCardStatus.EARNED, CouponCardStatus.REDEEMED] },
      },
    });
    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
  });

  it('con bonos ganados o redimidos no lo borra', async () => {
    prisma.couponCard.count.mockResolvedValue(1);
    await expect(service.remove('b-1', 'c-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.coupon.delete).not.toHaveBeenCalled();
  });

  it('no borra cupones de otro negocio', async () => {
    prisma.coupon.findFirst.mockResolvedValue(null);
    await expect(service.remove('b-2', 'c-1')).rejects.toThrow(
      'El cupón no existe',
    );
    expect(prisma.coupon.delete).not.toHaveBeenCalled();
  });
});
