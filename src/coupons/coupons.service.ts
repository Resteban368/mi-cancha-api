import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CouponCardStatus,
  CouponRewardType,
  ReservationStatus,
} from '../generated/prisma/enums.js';
import { pageArgs } from '../common/dto/page.dto.js';
import { couponImageUrl, publicApiUrl } from '../common/public-url.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isCouponExhausted,
  isCouponExpired,
  loadReservationMembers,
  memberBalance,
} from './coupon-stamps.js';
import {
  CouponCardDto,
  CouponCardPageDto,
  CouponCardsQueryDto,
  CouponDto,
  CouponRedemptionDto,
  CouponState,
  CreateCouponDto,
  CustomerCouponDto,
  PlayerCouponDto,
  PublicCouponDto,
  RedeemCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto.js';

const cardInclude = {
  stamps: { orderBy: { playedAt: 'asc' } },
} satisfies Prisma.CouponCardInclude;

type CardWithStamps = Prisma.CouponCardGetPayload<{
  include: typeof cardInclude;
}>;
type CouponRow = Prisma.CouponGetPayload<object>;

@Injectable()
export class CouponsService {
  private readonly utcOffset: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
    this.origin = publicApiUrl(config);
  }

  /** El último día válido termina a medianoche en la zona del negocio. */
  private endOfDay(date: string, current?: Date | null): Date {
    const end = new Date(`${date}T23:59:59.999${this.utcOffset}`);
    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException('La fecha de vencimiento no es válida');
    }
    // Editar otro dato de un cupón ya vencido reenvía su misma fecha.
    if (current?.getTime() === end.getTime()) return end;
    if (end <= new Date()) {
      throw new BadRequestException(
        'La fecha de vencimiento debe ser hoy o una fecha futura',
      );
    }
    return end;
  }

  async findAll(businessId: string): Promise<CouponDto[]> {
    const coupons = await this.prisma.coupon.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return coupons.map((coupon) => toCouponDto(coupon, this.origin));
  }

  async create(businessId: string, dto: CreateCouponDto): Promise<CouponDto> {
    const coupon = await this.prisma.coupon.create({
      data: {
        businessId,
        name: dto.name.trim(),
        requiredReservations: dto.requiredReservations,
        rewardType: dto.rewardType,
        percent:
          dto.rewardType === CouponRewardType.PERCENT ? dto.percent : null,
        rewardDescription: dto.rewardDescription.trim(),
        expiresAt: dto.expiresOn ? this.endOfDay(dto.expiresOn) : null,
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
    return toCouponDto(coupon, this.origin);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<CouponDto> {
    const existing = await this.requireCoupon(businessId, id);
    if (
      dto.maxRedemptions != null &&
      dto.maxRedemptions < existing.redeemedCount
    ) {
      throw new ConflictException(
        `Ya se redimieron ${existing.redeemedCount} bonos: el límite no puede ser menor`,
      );
    }
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        rewardDescription: dto.rewardDescription?.trim(),
        expiresAt:
          dto.expiresOn === undefined
            ? undefined
            : dto.expiresOn && this.endOfDay(dto.expiresOn, existing.expiresAt),
        maxRedemptions: dto.maxRedemptions,
        isActive: dto.isActive,
      },
    });
    return toCouponDto(coupon, this.origin);
  }

  /**
   * Borra el cupón con el avance de sus clientes. Si ya hay bonos ganados o
   * redimidos no se borra, para no quitarle el premio a nadie ni perder el
   * historial: se desactiva. Devuelve la imagen que queda sin uso.
   */
  async remove(businessId: string, id: string): Promise<string | null> {
    const coupon = await this.requireCoupon(businessId, id);
    const bonuses = await this.prisma.couponCard.count({
      where: {
        couponId: id,
        status: { in: [CouponCardStatus.EARNED, CouponCardStatus.REDEEMED] },
      },
    });
    if (bonuses > 0) {
      throw new ConflictException(
        'Este cupón ya tiene bonos ganados o redimidos: no se puede borrar. Desactívalo para que no sume más reservas.',
      );
    }
    await this.prisma.coupon.delete({ where: { id } });
    return coupon.imagePath;
  }

  async findOne(businessId: string, id: string): Promise<CouponDto> {
    return toCouponDto(await this.requireCoupon(businessId, id), this.origin);
  }

  /** Tarjetas del cupón con su historial; las redimidas, de la más reciente a la más antigua. */
  async cards(
    businessId: string,
    id: string,
    query: CouponCardsQueryDto,
  ): Promise<CouponCardPageDto> {
    const coupon = await this.requireCoupon(businessId, id);
    const where: Prisma.CouponCardWhereInput = {
      couponId: id,
      status: query.status,
      ...(query.search && {
        customer: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.couponCard.findMany({
        where,
        include: {
          ...cardInclude,
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [
          { redeemedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        ...pageArgs(query),
      }),
      this.prisma.couponCard.count({ where }),
    ]);
    return {
      items: items.map((card): CouponCardDto => ({
        id: card.id,
        customer: card.customer,
        status: card.status,
        completed: card.stamps.length,
        required: coupon.requiredReservations,
        earnedAt: card.earnedAt,
        redeemedAt: card.redeemedAt,
        redeemedCourts: card.redeemedCourts,
        redeemedAmount:
          card.redeemedAmount === null ? null : Number(card.redeemedAmount),
        stamps: card.stamps.map(toStampDto),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async requireCoupon(businessId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, businessId },
    });
    if (!coupon) throw new NotFoundException('El cupón no existe');
    return coupon;
  }

  /** Avance del cliente en cada cupón, con el historial de reservas de cada tarjeta. */
  async forCustomer(
    businessId: string,
    customerId: string,
    now = new Date(),
  ): Promise<CustomerCouponDto[]> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('El cliente no existe');

    const coupons = await this.prisma.coupon.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        cards: {
          where: { customerId },
          orderBy: { cycle: 'desc' },
          take: 1,
          include: cardInclude,
        },
      },
    });
    return coupons
      .map((coupon) =>
        toCustomerCoupon(coupon, coupon.cards[0], now, this.origin),
      )
      .filter(
        (row) =>
          row.coupon.state === 'ACTIVE' ||
          (row.coupon.state === 'INACTIVE' &&
            row.status === CouponCardStatus.EARNED),
      );
  }

  /**
   * Usa un bono al cobrar la reserva: baja el valor de la cancha y deja el saldo
   * listo para el pago presencial. Si ya hay abonos que superarían el nuevo
   * total se rechaza, para no dejar un saldo a favor sin devolver.
   */
  async redeem(
    businessId: string,
    reservationId: string,
    dto: RedeemCouponDto,
    now = new Date(),
  ): Promise<CouponRedemptionDto> {
    return this.prisma.$transaction(async (tx) => {
      const loaded = await loadReservationMembers(
        tx,
        businessId,
        reservationId,
      );
      if (!loaded) throw new NotFoundException('La reserva no existe');
      const { key, customerId, members } = loaded;
      if (
        members.length === 0 ||
        members.some((m) => m.status === ReservationStatus.NO_SHOW)
      ) {
        throw new ConflictException('Esta reserva no admite redimir un bono');
      }

      const card = await tx.couponCard.findFirst({
        where: {
          id: dto.cardId,
          customerId: customerId ?? undefined,
          coupon: { businessId },
        },
        include: { coupon: true },
      });
      if (!customerId || !card) {
        throw new NotFoundException('Este cliente no tiene ese bono');
      }
      if (card.status !== CouponCardStatus.EARNED) {
        throw new ConflictException('El bono no está disponible');
      }
      if (isCouponExpired(card.coupon, now)) {
        throw new ConflictException('El cupón ya venció');
      }
      const used = await tx.couponCard.findUnique({
        where: { redemptionKey: key },
        select: { id: true },
      });
      if (used) {
        throw new ConflictException('Esta reserva ya usó un bono');
      }

      const durations = await tx.reservation.findMany({
        where: { id: { in: members.map((m) => m.id) } },
        select: {
          id: true,
          start: true,
          end: true,
          subtotal: true,
          court: { select: { slotDuration: true } },
        },
      });
      const discounts = discountsFor(
        card.coupon,
        members,
        durations,
        dto.courts,
      );
      const amount = round2(
        [...discounts.values()].reduce((sum, value) => sum + value, 0),
      );
      const balance = memberBalance(members);
      if (amount > balance) {
        throw new ConflictException(
          'La reserva ya tiene pagos que superan el valor con el bono',
        );
      }

      // El tope va en el filtro: dos cobros en paralelo no pueden pasarlo.
      const { maxRedemptions } = card.coupon;
      const claimed = await tx.coupon.updateMany({
        where: {
          id: card.couponId,
          ...(maxRedemptions !== null && {
            redeemedCount: { lt: maxRedemptions },
          }),
        },
        data: { redeemedCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          'El cupón ya alcanzó su límite de redenciones',
        );
      }

      const courts =
        card.coupon.rewardType === CouponRewardType.FREE_COURT
          ? discounts.size
          : null;
      // El estado en el filtro evita usar el mismo bono dos veces en paralelo.
      const { count } = await tx.couponCard.updateMany({
        where: { id: card.id, status: CouponCardStatus.EARNED },
        data: {
          status: CouponCardStatus.REDEEMED,
          redeemedAt: now,
          redemptionKey: key,
          redeemedCourts: courts,
          redeemedAmount: amount,
        },
      });
      if (count === 0) {
        throw new ConflictException('El bono no está disponible');
      }
      for (const [id, value] of discounts) {
        await tx.reservation.update({
          where: { id },
          data: {
            discount: { increment: value },
            totalPrice: { decrement: value },
          },
        });
      }
      return {
        cardId: card.id,
        amount,
        courts,
        balance: round2(balance - amount),
      };
    });
  }

  /** Cupones que el negocio ofrece hoy: activos, vigentes y con cupo. */
  async publicForBusiness(
    slug: string,
    now = new Date(),
  ): Promise<PublicCouponDto[]> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: {
        coupons: {
          where: {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!business) throw new NotFoundException('Este negocio no existe');
    return business.coupons
      .filter((coupon) => !isCouponExhausted(coupon))
      .map((coupon) => ({
        id: coupon.id,
        name: coupon.name,
        requiredReservations: coupon.requiredReservations,
        rewardDescription: coupon.rewardDescription,
        imageUrl: coupon.imageId
          ? couponImageUrl(this.origin, coupon.imageId)
          : null,
        expiresAt: coupon.expiresAt,
      }));
  }

  /**
   * Tarjetas del jugador en cada negocio: las que ya empezó y sigan vigentes.
   * Un cupón pausado solo aparece si ya tiene el bono, que aún puede usar.
   */
  async forPlayer(
    userId: string,
    now = new Date(),
  ): Promise<PlayerCouponDto[]> {
    const customers = await this.prisma.customer.findMany({
      where: { userId },
      select: {
        business: { select: { name: true, slug: true } },
        couponCards: {
          orderBy: { cycle: 'desc' },
          include: { ...cardInclude, coupon: true },
        },
      },
    });
    const rows = customers.flatMap((customer) => {
      // Las tarjetas vienen de la más nueva a la más antigua: basta la última de cada cupón.
      const latest = new Map(
        [...customer.couponCards]
          .reverse()
          .map((card) => [card.couponId, card]),
      );
      return [...latest.values()].flatMap((card) => {
        const { coupon } = card;
        const row = toCustomerCoupon(coupon, card, now, this.origin);
        const earned = row.status === CouponCardStatus.EARNED;
        const visible =
          row.cardId !== null &&
          (row.coupon.state === 'ACTIVE' ||
            (row.coupon.state === 'INACTIVE' && earned));
        if (!visible) return [];
        return [
          {
            couponId: coupon.id,
            businessName: customer.business.name,
            businessSlug: customer.business.slug,
            name: coupon.name,
            rewardDescription: coupon.rewardDescription,
            imageUrl: row.coupon.imageUrl,
            status: row.status,
            completed: row.completed,
            required: row.required,
            remaining: earned ? 0 : Math.max(row.required - row.completed, 0),
            expiresAt: coupon.expiresAt,
          },
        ];
      });
    });
    // Primero los bonos listos, luego los que están más cerca.
    return rows.sort((a, b) => a.remaining - b.remaining);
  }
}

type Priced = Parameters<typeof memberBalance>[0][number];
type Duration = {
  id: string;
  start: Date;
  end: Date;
  subtotal: Prisma.Decimal | number;
  court: { slotDuration: number };
};

/** Descuento por cancha: el porcentaje sobre su valor, o un turno de las canchas regaladas. */
function discountsFor(
  coupon: { rewardType: CouponRewardType; percent: number | null },
  members: Priced[],
  durations: Duration[],
  courts: number | undefined,
): Map<string, number> {
  const discounts = new Map<string, number>();
  if (coupon.rewardType === CouponRewardType.PERCENT) {
    if (courts !== undefined) {
      throw new BadRequestException(
        'Un bono de porcentaje aplica a toda la reserva',
      );
    }
    for (const member of members) {
      discounts.set(
        member.id,
        round2((Number(member.totalPrice) * (coupon.percent ?? 0)) / 100),
      );
    }
    return discounts;
  }

  const gifted = courts ?? members.length;
  if (gifted > members.length) {
    throw new BadRequestException(
      `La reserva solo tiene ${members.length} cancha(s)`,
    );
  }
  for (const member of members.slice(0, gifted)) {
    const row = durations.find((d) => d.id === member.id);
    if (!row) continue;
    const minutes = (row.end.getTime() - row.start.getTime()) / 60_000;
    const slots = Math.max(1, Math.round(minutes / row.court.slotDuration));
    discounts.set(
      member.id,
      Math.min(Number(member.totalPrice), round2(Number(row.subtotal) / slots)),
    );
  }
  return discounts;
}

function toCustomerCoupon(
  coupon: CouponRow,
  card: CardWithStamps | undefined,
  now: Date,
  origin: string,
): CustomerCouponDto {
  // Una tarjeta redimida ya no cuenta: el cliente vuelve a empezar.
  const open =
    card && card.status !== CouponCardStatus.REDEEMED ? card : undefined;
  return {
    coupon: toCouponDto(coupon, origin, now),
    cardId: open?.id ?? null,
    status: open?.status ?? CouponCardStatus.IN_PROGRESS,
    completed: open?.stamps.length ?? 0,
    required: coupon.requiredReservations,
    earnedAt: open?.earnedAt ?? null,
    stamps: (open?.stamps ?? []).map(toStampDto),
  };
}

function toStampDto(s: CardWithStamps['stamps'][number]) {
  return {
    reservationId: s.reservationId,
    playedAt: s.playedAt,
    stampedAt: s.createdAt,
    courts: s.courts,
    courtNames: s.courtNames,
    amount: Number(s.amount),
  };
}

function couponState(c: CouponRow, now: Date): CouponState {
  if (isCouponExpired(c, now)) return 'EXPIRED';
  if (isCouponExhausted(c)) return 'EXHAUSTED';
  return c.isActive ? 'ACTIVE' : 'INACTIVE';
}

function toCouponDto(
  c: CouponRow,
  origin: string,
  now = new Date(),
): CouponDto {
  return {
    id: c.id,
    name: c.name,
    requiredReservations: c.requiredReservations,
    rewardType: c.rewardType,
    percent: c.percent,
    rewardDescription: c.rewardDescription,
    imageUrl: c.imageId ? couponImageUrl(origin, c.imageId) : null,
    expiresAt: c.expiresAt,
    maxRedemptions: c.maxRedemptions,
    redeemedCount: c.redeemedCount,
    state: couponState(c, now),
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
