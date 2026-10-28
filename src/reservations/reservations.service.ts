import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import { courtPhotoUrl, publicApiUrl } from '../common/public-url.js';
import { isWriteConflict } from '../common/filters/prisma-exception.filter.js';
import { dayRange } from '../common/utils/day-range.js';
import {
  daySlots,
  localDate,
  previousDate,
  priceFor,
  reservationIntervals,
  type Slot,
} from '../courts/court-time.js';
import {
  courtInclude,
  type CourtWithDetails,
  REQUIRED_PHOTOS,
} from '../courts/courts.service.js';
import {
  CustomersService,
  normalizeDocument,
  toCustomerDto,
} from '../customers/customers.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  Prisma,
  type SlotHold,
  type User,
} from '../generated/prisma/client.js';
import {
  CourtPhotoSlot,
  PaymentConcept,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  SaleStatus,
  type Sport,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { saleInclude, toSaleDto } from '../sales/sales.service.js';
import {
  AvailabilityDto,
  CancelReservationDto,
  CreateReservationDto,
  MAX_GROUP_COURTS,
  MAX_SLOTS,
  ReservationDto,
  ReservationsQueryDto,
  SlotDto,
  SportAvailabilityDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto.js';

/** Estados que ocupan la cancha en su horario. */
const BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
];
const DEFAULT_PAYMENT_METHOD = 'EFECTIVO';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Minutos después de su inicio en que un turno todavía se puede reservar. */
export const LATE_BOOKING_MINUTES = 15;

/** Reglas de las reservas hechas por jugadores desde la web. */
export interface WebBookingRules {
  minAdvanceMinutes: number;
  maxDaysAhead: number;
  maxReservationsPerDay: number;
  /** Turnos seguidos por reserva (y por apartado). */
  maxSlots: number;
  /** Minutos que dura un apartado si el jugador no confirma. */
  holdMinutes: number;
}

type Range = { start: Date; end: Date };
type Claimed = { court: CourtWithDetails; first: Slot; last: Slot };
/** Turnos que el jugador elige en la web: 1 a 3 canchas en la misma franja. */
export type WebSlotsInput = {
  courtIds: string[];
  start: string;
  slots: number;
};
type Prices = { subtotal: number; discount: number; totalPrice: number };

export const reservationInclude = {
  court: { select: { name: true, sport: true, currency: true } },
  customer: true,
  cancelledBy: { select: { displayName: true } },
  payments: {
    include: { method: { select: { code: true } } },
    orderBy: { receivedAt: 'asc' },
  },
  sales: { include: saleInclude, orderBy: { createdAt: 'asc' } },
  group: {
    include: {
      reservations: {
        select: {
          id: true,
          courtId: true,
          totalPrice: true,
          consumptionsTotal: true,
          court: { select: { name: true } },
          payments: { select: { status: true, amount: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  },
} satisfies Prisma.ReservationInclude;

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

@Injectable()
export class ReservationsService {
  private readonly utcOffset: string;
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly customers: CustomersService,
    private readonly catalogs: CatalogsService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
    this.publicApiUrl = publicApiUrl(config);
  }

  // ---------- Administrador de negocio (por ownerId) ----------

  async list(
    ownerId: string,
    query: ReservationsQueryDto,
  ): Promise<ReservationDto[] | Page<ReservationDto>> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.listForBusiness(businessId, query);
  }

  async findOne(ownerId: string, id: string): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return toReservationDto(await this.findOwned(businessId, id));
  }

  async sportAvailabilityForOwner(
    ownerId: string,
    sport: Sport,
    date: string,
  ): Promise<SportAvailabilityDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.sportAvailability(businessId, sport, date);
  }

  async availabilityForOwner(
    ownerId: string,
    courtId: string,
    date: string,
  ): Promise<AvailabilityDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.availability(businessId, courtId, date);
  }

  async create(
    ownerId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.createForBusiness(businessId, dto);
  }

  async updateStatus(
    ownerId: string,
    id: string,
    dto: UpdateReservationStatusDto,
  ): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const reservation = await this.findOwned(businessId, id);
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new ConflictException(
        'Una reserva cancelada no se puede modificar',
      );
    }
    // En un grupo, el estado aplica a todas sus canchas.
    await this.prisma.reservation.updateMany({
      where: reservation.groupId
        ? {
            groupId: reservation.groupId,
            status: { not: ReservationStatus.CANCELLED },
          }
        : { id: reservation.id },
      data: { status: dto.status },
    });
    return toReservationDto(await this.findOwned(businessId, reservation.id));
  }

  async cancel(
    ownerId: string,
    id: string,
    dto: CancelReservationDto,
  ): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    return this.cancelForBusiness(businessId, id, dto, ownerId);
  }

  // ---------- Núcleo por negocio (también lo usa el super admin) ----------

  /**
   * Con `date`: agenda de ese día (lista ordenada por hora). Sin `date`: página
   * de reservas de la más reciente a la más antigua. Los demás filtros aplican
   * en ambos casos.
   */
  async listForBusiness(
    businessId: string,
    query: ReservationsQueryDto,
  ): Promise<ReservationDto[] | Page<ReservationDto>> {
    const where = this.listWhere(businessId, query);
    if (query.date) {
      const reservations = await this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { start: 'asc' },
      });
      return reservations.map(toReservationDto);
    }
    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { start: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      items: items.map(toReservationDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private listWhere(
    businessId: string,
    query: ReservationsQueryDto,
  ): Prisma.ReservationWhereInput {
    let start: Prisma.DateTimeFilter | undefined;
    if (query.date) {
      const { from, to } = dayRange(query.date, this.utcOffset);
      start = { gte: from, lt: to };
    } else if (query.from || query.to) {
      if (query.from && query.to && query.from > query.to) {
        throw new BadRequestException('from no puede ser posterior a to');
      }
      start = {
        ...(query.from && {
          gte: dayRange(query.from, this.utcOffset).from,
        }),
        ...(query.to && { lt: dayRange(query.to, this.utcOffset).to }),
      };
    }

    const term = query.search?.trim();
    const digits = term?.replace(/\D/g, '');
    return {
      businessId,
      start,
      status: query.status,
      courtId: query.courtId,
      customerId: query.customerId,
      source: query.source,
      ...(term && {
        OR: [
          { customerName: { contains: term, mode: 'insensitive' } },
          ...(digits
            ? [
                { phone: { contains: digits } },
                {
                  customer: {
                    documentId: { contains: normalizeDocument(term) },
                  },
                },
              ]
            : []),
        ],
      }),
    };
  }

  /** Turnos del día de una cancha con su estado y precio. */
  async availability(
    businessId: string,
    courtId: string,
    date: string,
    now = new Date(),
  ): Promise<AvailabilityDto> {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, businessId },
      include: courtInclude,
    });
    if (!court) throw new NotFoundException('La cancha no existe');

    const slots = daySlots(
      date,
      court.schedules,
      court.slotDuration,
      this.utcOffset,
    );
    const booked = await this.bookedRanges([court.id], slots);
    return {
      date,
      courtId,
      slotDuration: court.slotDuration,
      currency: court.currency,
      maxSlots: MAX_SLOTS,
      slots: this.slotsWithStatus(
        court,
        slots,
        booked.get(court.id) ?? [],
        now,
      ),
    };
  }

  /**
   * Turnos del día de todas las canchas reservables (activas y con sus 3 fotos)
   * de un deporte, una tarjeta por cancha.
   */
  async sportAvailability(
    businessId: string,
    sport: Sport,
    date: string,
    now = new Date(),
    { withHolds = false }: { withHolds?: boolean } = {},
  ): Promise<SportAvailabilityDto> {
    const courts = (
      await this.prisma.court.findMany({
        where: { businessId, sport, isActive: true },
        include: courtInclude,
        orderBy: { name: 'asc' },
      })
    ).filter(isComplete);

    const daySlotsByCourt = new Map(
      courts.map((c) => [
        c.id,
        daySlots(date, c.schedules, c.slotDuration, this.utcOffset),
      ]),
    );
    const allSlots = [...daySlotsByCourt.values()].flat();
    const courtIds = courts.map((c) => c.id);
    const [booked, held] = await Promise.all([
      this.bookedRanges(courtIds, allSlots),
      withHolds
        ? this.heldRanges(courtIds, allSlots, now)
        : new Map<string, Range[]>(),
    ]);

    return {
      date,
      sport,
      maxSlots: MAX_SLOTS,
      courts: courts.map((court) => {
        const slots = this.slotsWithStatus(
          court,
          daySlotsByCourt.get(court.id)!,
          booked.get(court.id) ?? [],
          now,
          held.get(court.id) ?? [],
        );
        const main = court.photos.find((p) => p.slot === CourtPhotoSlot.MAIN);
        return {
          court: {
            id: court.id,
            name: court.name,
            sport: court.sport,
            isCovered: court.isCovered,
            slotDuration: court.slotDuration,
            currency: court.currency,
            photoUrl: main ? courtPhotoUrl(this.publicApiUrl, main.id) : null,
            surfaceName: court.surface?.name ?? null,
            lengthMeters:
              court.lengthMeters === null ? null : Number(court.lengthMeters),
            widthMeters:
              court.widthMeters === null ? null : Number(court.widthMeters),
            playersPerSide: court.playersPerSide,
          },
          availableCount: slots.filter((s) => s.status === 'AVAILABLE').length,
          slots,
        };
      }),
    };
  }

  /** Reservas que ocupan las canchas dentro del rango de los turnos, por cancha. */
  private async bookedRanges(
    courtIds: string[],
    slots: Slot[],
  ): Promise<Map<string, { start: Date; end: Date }[]>> {
    const byCourt = new Map<string, { start: Date; end: Date }[]>();
    if (!courtIds.length || !slots.length) return byCourt;
    const from = new Date(Math.min(...slots.map((s) => s.start.getTime())));
    const to = new Date(Math.max(...slots.map((s) => s.end.getTime())));
    const reservations = await this.prisma.reservation.findMany({
      where: {
        courtId: { in: courtIds },
        status: { in: BLOCKING_STATUSES },
        start: { lt: to },
        end: { gt: from },
      },
      select: { courtId: true, start: true, end: true },
    });
    for (const r of reservations) {
      byCourt.set(r.courtId, [...(byCourt.get(r.courtId) ?? []), r]);
    }
    return byCourt;
  }

  /** Apartados vigentes de la web dentro del rango de los turnos, por cancha. */
  private async heldRanges(
    courtIds: string[],
    slots: Slot[],
    now: Date,
  ): Promise<Map<string, Range[]>> {
    const byCourt = new Map<string, Range[]>();
    if (!courtIds.length || !slots.length) return byCourt;
    const from = new Date(Math.min(...slots.map((s) => s.start.getTime())));
    const to = new Date(Math.max(...slots.map((s) => s.end.getTime())));
    const holds = await this.prisma.slotHold.findMany({
      where: {
        courtId: { in: courtIds },
        expiresAt: { gt: now },
        start: { lt: to },
        end: { gt: from },
      },
      select: { courtId: true, start: true, end: true },
    });
    for (const h of holds) {
      byCourt.set(h.courtId, [...(byCourt.get(h.courtId) ?? []), h]);
    }
    return byCourt;
  }

  private slotsWithStatus(
    court: CourtWithDetails,
    slots: Slot[],
    booked: Range[],
    now: Date,
    held: Range[] = [],
  ): SlotDto[] {
    const rates = courtRates(court);
    const base = Number(court.basePricePerHour);
    const overlaps = (ranges: Range[], slot: Slot) =>
      ranges.some((r) => r.start < slot.end && r.end > slot.start);
    return slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      status: overlaps(booked, slot)
        ? 'BOOKED'
        : lateBookingError(slot, now)
          ? 'PAST'
          : overlaps(held, slot)
            ? 'HELD'
            : 'AVAILABLE',
      price: priceFor(
        reservationIntervals(slot.start, slot.end, this.utcOffset),
        base,
        rates,
      ),
    }));
  }

  async createForBusiness(
    businessId: string,
    dto: CreateReservationDto,
    now = new Date(),
  ): Promise<ReservationDto> {
    if (!dto.customerId === !dto.customer) {
      throw new BadRequestException(
        'Envía customerId (cliente existente) o customer (cliente nuevo), uno de los dos',
      );
    }
    const picks = [dto.courtId, dto.courtIds, dto.sport].filter(
      (x) => x !== undefined,
    ).length;
    if (picks !== 1) {
      throw new BadRequestException(
        'Envía courtId (una cancha), courtIds (varias canchas) o sport (cualquier cancha libre de ese deporte), uno de los tres',
      );
    }
    if (dto.courts !== undefined && !dto.sport) {
      throw new BadRequestException('courts solo aplica junto con sport');
    }
    const start = new Date(dto.start);

    // Serializable evita que dos reservas simultáneas tomen el mismo turno.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const claimed = dto.sport
          ? await this.claimAnyCourts(
              tx,
              businessId,
              dto.sport,
              start,
              dto.slots,
              dto.courts ?? 1,
              now,
            )
          : await this.claimCourts(
              tx,
              businessId,
              dto.courtIds ?? [dto.courtId!],
              start,
              dto.slots,
              now,
            );

        const prices = this.groupPrices(claimed, dto.discount ?? 0);
        const groupTotal = round2(
          prices.reduce((sum, p) => sum + p.totalPrice, 0),
        );
        const payment = dto.payment
          ? await this.paymentData(dto.payment, groupTotal)
          : null;

        const customer = await this.customers.resolve(tx, businessId, dto);
        return this.createReservations(
          tx,
          businessId,
          claimed,
          prices,
          {
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            customerDetail: dto.customerDetail,
            contactNote: dto.contactNote,
            tag: dto.tag,
            isRecurring: dto.isRecurring ?? false,
          },
          payment && { ...payment, customerName: customer.name },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toReservationDto(reservation);
  }

  /**
   * Valor de cada cancha según sus tarifas. El descuento es sobre el total y
   * se reparte en proporción al valor de cada una (el redondeo queda en la última).
   */
  private groupPrices(claimed: Claimed[], discount: number): Prices[] {
    const subtotals = claimed.map(({ court, first, last }) =>
      priceFor(
        reservationIntervals(first.start, last.end, this.utcOffset),
        Number(court.basePricePerHour),
        courtRates(court),
      ),
    );
    const total = round2(subtotals.reduce((sum, v) => sum + v, 0));
    if (discount > total) {
      throw new BadRequestException(
        `El descuento no puede superar el valor de la reserva (${total})`,
      );
    }
    // Un descuento entero (lo normal en pesos) se reparte en enteros.
    const roundShare = Number.isInteger(discount) ? Math.round : round2;
    let left = discount;
    return subtotals.map((subtotal, i) => {
      const share =
        i === subtotals.length - 1
          ? round2(left)
          : total > 0
            ? roundShare((discount * subtotal) / total)
            : 0;
      left = round2(left - share);
      return {
        subtotal,
        discount: share,
        totalPrice: round2(subtotal - share),
      };
    });
  }

  /**
   * Crea una reserva por cancha; con más de una las une en un grupo. El pago
   * (si hay) queda en la primera. Devuelve la primera con su grupo.
   */
  private async createReservations(
    tx: Prisma.TransactionClient,
    businessId: string,
    claimed: Claimed[],
    prices: Prices[],
    common: Omit<
      Prisma.ReservationUncheckedCreateInput,
      | 'businessId'
      | 'courtId'
      | 'start'
      | 'end'
      | 'subtotal'
      | 'discount'
      | 'totalPrice'
      | 'groupId'
    >,
    payment: Omit<
      Prisma.PaymentUncheckedCreateWithoutReservationInput,
      'businessId'
    > | null,
  ): Promise<ReservationWithRelations> {
    const groupId =
      claimed.length > 1
        ? (
            await tx.reservationGroup.create({
              data: { businessId },
              select: { id: true },
            })
          ).id
        : null;
    let firstId = '';
    for (const [i, { court, first, last }] of claimed.entries()) {
      const created = await tx.reservation.create({
        data: {
          ...common,
          businessId,
          courtId: court.id,
          groupId,
          start: first.start,
          end: last.end,
          ...prices[i],
          ...(i === 0 &&
            payment && {
              payments: { create: { ...payment, businessId } },
            }),
        },
        select: { id: true },
      });
      if (i === 0) firstId = created.id;
    }
    return tx.reservation.findUniqueOrThrow({
      where: { id: firstId },
      include: reservationInclude,
    });
  }

  /**
   * Reserva hecha por un jugador desde la web del negocio: queda confirmada,
   * sin pago (se paga en efectivo en la sede) y con origen WEB. Además de las
   * reglas del negocio aplica anticipación mínima y máxima y un tope diario.
   */
  async createWebReservation(
    businessId: string,
    player: User,
    input: WebSlotsInput & { notes?: string },
    rules: WebBookingRules,
    now = new Date(),
  ): Promise<ReservationDto> {
    const reservation = await this.webTransaction(async (tx) => {
      const claimed = await this.claimWebSlots(
        tx,
        businessId,
        player.id,
        input,
        rules,
        now,
      );

      const customer = await this.customers.resolveForPlayer(
        tx,
        businessId,
        player,
      );
      const day = dayRange(
        localDate(claimed[0].first.start, this.utcOffset),
        this.utcOffset,
      );
      // Una reserva de varias canchas cuenta como una.
      const sameDay = await tx.reservation.findMany({
        where: {
          businessId,
          customerId: customer.id,
          status: { not: ReservationStatus.CANCELLED },
          start: { gte: day.from, lt: day.to },
        },
        select: { id: true, groupId: true },
      });
      const reservationsToday = new Set(sameDay.map((r) => r.groupId ?? r.id))
        .size;
      if (reservationsToday >= rules.maxReservationsPerDay) {
        throw new ConflictException(
          `Puedes tener máximo ${rules.maxReservationsPerDay} reservas por día en esta sede`,
        );
      }

      const created = await this.createReservations(
        tx,
        businessId,
        claimed,
        this.groupPrices(claimed, 0),
        {
          customerId: customer.id,
          playerId: player.id,
          source: ReservationSource.WEB,
          customerName: customer.name,
          phone: customer.phone,
          contactNote: input.notes?.trim() || null,
        },
        null,
      );
      // El apartado ya cumplió: el turno queda reservado.
      await tx.slotHold.deleteMany({
        where: { businessId, playerId: player.id },
      });
      return created;
    });
    await this.notifications.notifyNewReservation({
      ...reservation,
      courtCount: reservation.group?.reservations.length,
    });
    return toReservationDto(reservation);
  }

  /**
   * Aparta turnos en la web mientras el jugador confirma: reemplaza su
   * apartado anterior en el negocio y vence en `rules.holdMinutes`.
   */
  async holdWebSlots(
    businessId: string,
    playerId: string,
    input: WebSlotsInput,
    rules: WebBookingRules,
    now = new Date(),
  ): Promise<SlotHold[]> {
    return this.webTransaction(async (tx) => {
      const claimed = await this.claimWebSlots(
        tx,
        businessId,
        playerId,
        input,
        rules,
        now,
      );
      const expiresAt = new Date(now.getTime() + rules.holdMinutes * 60_000);
      await tx.slotHold.deleteMany({ where: { businessId, playerId } });
      await tx.slotHold.createMany({
        data: claimed.map(({ court, first, last }) => ({
          businessId,
          playerId,
          courtId: court.id,
          start: first.start,
          end: last.end,
          slots: input.slots,
          expiresAt,
        })),
      });
      return tx.slotHold.findMany({
        where: { businessId, playerId },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  /**
   * Transacción Serializable para tomar turnos desde la web. Si otro jugador
   * toma el mismo turno a la vez, una de las dos falla: se responde como turno
   * ocupado para que la página refresque y el jugador elija otro.
   */
  private async webTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const conflict =
        isWriteConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002'));
      if (!conflict) throw error;
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SLOT_HELD',
        message: 'Otra persona acaba de tomar ese turno. Elige otro horario.',
      });
    }
  }

  /** El apartado vigente del jugador en el negocio: una fila por cancha (vacío si no tiene). */
  currentHold(
    businessId: string,
    playerId: string,
    now = new Date(),
  ): Promise<SlotHold[]> {
    return this.prisma.slotHold.findMany({
      where: { businessId, playerId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async releaseHold(businessId: string, playerId: string): Promise<void> {
    await this.prisma.slotHold.deleteMany({ where: { businessId, playerId } });
  }

  /**
   * Turnos que un jugador puede tomar desde la web: libres, dentro de la
   * ventana de reserva y sin apartado vigente de otro jugador.
   */
  private async claimWebSlots(
    tx: Prisma.TransactionClient,
    businessId: string,
    playerId: string,
    input: WebSlotsInput,
    rules: WebBookingRules,
    now: Date,
  ): Promise<Claimed[]> {
    if (input.slots > rules.maxSlots) {
      throw new BadRequestException(
        `Puedes elegir máximo ${rules.maxSlots} turnos seguidos`,
      );
    }
    const claimed = await this.claimCourts(
      tx,
      businessId,
      input.courtIds,
      new Date(input.start),
      input.slots,
      now,
    );
    const { first, last } = claimed[0];
    if (
      first.start.getTime() <
      now.getTime() + rules.minAdvanceMinutes * 60_000
    ) {
      throw new BadRequestException(
        rules.minAdvanceMinutes > 0
          ? `Reserva con al menos ${rules.minAdvanceMinutes} minutos de anticipación`
          : `Ese turno empezó hace más de ${-rules.minAdvanceMinutes} minutos`,
      );
    }
    if (first.start.getTime() > now.getTime() + rules.maxDaysAhead * DAY_MS) {
      throw new BadRequestException(
        `Solo se puede reservar hasta ${rules.maxDaysAhead} días adelante`,
      );
    }
    const heldByOther = await tx.slotHold.findFirst({
      where: {
        courtId: { in: claimed.map((c) => c.court.id) },
        playerId: { not: playerId },
        expiresAt: { gt: now },
        start: { lt: last.end },
        end: { gt: first.start },
      },
      select: { id: true },
    });
    if (heldByOther) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SLOT_HELD',
        message: 'Otra persona está reservando ese turno. Elige otro horario.',
      });
    }
    return claimed;
  }

  /** Reservas de un jugador en un negocio, de la más próxima a la más antigua. */
  async listForPlayer(
    businessId: string,
    playerId: string,
  ): Promise<ReservationDto[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        businessId,
        OR: [{ playerId }, { customer: { userId: playerId } }],
      },
      include: reservationInclude,
      orderBy: { start: 'desc' },
      take: 100,
    });
    return reservations.map(toReservationDto);
  }

  /**
   * Cancela una reserva confirmada con su motivo y libera el turno. Los pagos
   * aprobados quedan REFUNDED con su devolución; los pendientes, rechazados.
   */
  async cancelForBusiness(
    businessId: string,
    id: string,
    dto: CancelReservationDto,
    actorId: string,
  ): Promise<ReservationDto> {
    const reason = dto.reason.trim();
    const reservation = await this.prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({
        where: { id, businessId },
        select: { id: true, status: true, groupId: true },
      });
      if (!current) throw new NotFoundException('La reserva no existe');
      if (current.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException(
          'Solo se pueden cancelar reservas confirmadas',
        );
      }
      // En un grupo se cancelan todas sus canchas.
      const members = await tx.reservation.findMany({
        where: current.groupId
          ? { groupId: current.groupId, status: ReservationStatus.CONFIRMED }
          : { id: current.id },
        include: { payments: true },
      });
      for (const member of members) {
        await this.cancelOne(tx, businessId, member, reason, actorId);
      }
      return tx.reservation.findUniqueOrThrow({
        where: { id: current.id },
        include: reservationInclude,
      });
    });
    return toReservationDto(reservation);
  }

  private async cancelOne(
    tx: Prisma.TransactionClient,
    businessId: string,
    current: Prisma.ReservationGetPayload<{ include: { payments: true } }>,
    reason: string,
    actorId: string,
  ): Promise<void> {
    {
      for (const payment of current.payments) {
        if (payment.status === PaymentStatus.APPROVED) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              refund: {
                create: {
                  businessId,
                  reservationId: current.id,
                  customerId: current.customerId,
                  amount: payment.amount,
                  reason,
                  createdById: actorId,
                },
              },
            },
          });
        } else if (payment.status === PaymentStatus.PENDING) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REJECTED,
              rejectionReason: `Reserva cancelada: ${reason}`,
            },
          });
        }
      }

      // Sus consumos se anulan con ella (sus pagos ya quedaron devueltos arriba).
      await tx.sale.updateMany({
        where: { reservationId: current.id, status: SaleStatus.ACTIVE },
        data: {
          status: SaleStatus.VOIDED,
          voidReason: `Reserva cancelada: ${reason}`,
          voidedAt: new Date(),
        },
      });

      await tx.reservation.update({
        where: { id: current.id },
        data: {
          consumptionsTotal: 0,
          status: ReservationStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledById: actorId,
        },
      });
    }
  }

  /** La cancha pedida, si tiene esos turnos libres. */
  private async claimCourt(
    tx: Prisma.TransactionClient,
    businessId: string,
    courtId: string,
    start: Date,
    count: number,
    now: Date,
  ): Promise<{ court: CourtWithDetails; first: Slot; last: Slot }> {
    const court = await tx.court.findFirst({
      where: { id: courtId, businessId },
      include: courtInclude,
    });
    if (!court) throw new NotFoundException('La cancha no existe');
    assertBookable(court);

    const { first, last } = this.findSlots(court, start, count);
    const late = lateBookingError({ start: first.start, end: last.end }, now);
    if (late) throw new BadRequestException(late);
    if (await isTaken(tx, court.id, first.start, last.end)) {
      throw new ConflictException(
        `La cancha ${court.name} ya está reservada en ese horario`,
      );
    }
    return { court, first, last };
  }

  /**
   * Varias canchas a la vez: todas libres en la misma franja, del mismo deporte
   * y con el mismo turno. Si alguna no cumple, no se toma ninguna.
   */
  private async claimCourts(
    tx: Prisma.TransactionClient,
    businessId: string,
    courtIds: string[],
    start: Date,
    count: number,
    now: Date,
  ): Promise<Claimed[]> {
    if (!courtIds.length) {
      throw new BadRequestException('Elige al menos una cancha');
    }
    if (courtIds.length > MAX_GROUP_COURTS) {
      throw new BadRequestException(
        `Puedes reservar máximo ${MAX_GROUP_COURTS} canchas a la vez`,
      );
    }
    if (new Set(courtIds).size !== courtIds.length) {
      throw new BadRequestException('No repitas canchas en la misma reserva');
    }
    const claimed: Claimed[] = [];
    for (const courtId of courtIds) {
      const one = await this.claimCourt(
        tx,
        businessId,
        courtId,
        start,
        count,
        now,
      );
      const [base] = claimed;
      if (base && one.court.sport !== base.court.sport) {
        throw new BadRequestException(
          'Las canchas de una misma reserva deben ser del mismo deporte',
        );
      }
      if (base && one.court.slotDuration !== base.court.slotDuration) {
        throw new BadRequestException(
          'Las canchas de una misma reserva deben tener la misma duración de turno',
        );
      }
      claimed.push(one);
    }
    return claimed;
  }

  /**
   * Las primeras `courts` canchas reservables del deporte (por nombre) que tengan
   * un turno que empiece en `start`, `count` turnos seguidos libres y el mismo
   * turno que la primera.
   */
  private async claimAnyCourts(
    tx: Prisma.TransactionClient,
    businessId: string,
    sport: Sport,
    start: Date,
    count: number,
    courtsWanted: number,
    now: Date,
  ): Promise<Claimed[]> {
    const courts = (
      await tx.court.findMany({
        where: { businessId, sport, isActive: true },
        include: courtInclude,
        orderBy: { name: 'asc' },
      })
    ).filter(isComplete);
    if (!courts.length) {
      throw new NotFoundException(
        `No hay canchas de ${SPORT_LABELS[sport]} disponibles para reservar`,
      );
    }

    let matched = false;
    const claimed: Claimed[] = [];
    for (const court of courts) {
      let range: { first: Slot; last: Slot };
      try {
        range = this.findSlots(court, start, count);
      } catch {
        continue; // esta cancha no tiene ese turno o cierra antes
      }
      matched = true;
      const late = lateBookingError(
        { start: range.first.start, end: range.last.end },
        now,
      );
      if (late) throw new BadRequestException(late);
      const [base] = claimed;
      if (base && court.slotDuration !== base.court.slotDuration) continue;
      if (!(await isTaken(tx, court.id, range.first.start, range.last.end))) {
        claimed.push({ court, ...range });
        if (claimed.length === courtsWanted) return claimed;
      }
    }
    if (!matched) {
      throw new BadRequestException(
        `Ninguna cancha de ${SPORT_LABELS[sport]} tiene ${count} turno(s) seguidos desde ese inicio (consulta la disponibilidad)`,
      );
    }
    if (claimed.length > 0) {
      throw new ConflictException(
        `Solo hay ${claimed.length} cancha(s) de ${SPORT_LABELS[sport]} libres en ese horario`,
      );
    }
    throw new ConflictException(
      `No hay canchas de ${SPORT_LABELS[sport]} libres en ese horario`,
    );
  }

  private async findOwned(
    businessId: string,
    id: string,
  ): Promise<ReservationWithRelations> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, businessId },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('La reserva no existe');
    return reservation;
  }

  /**
   * Turnos que ocupa la reserva: `start` debe ser el inicio de un turno del día
   * (o del día anterior, si su horario pasa de la medianoche) y deben existir
   * `count` turnos seguidos dentro del mismo horario.
   */
  private findSlots(
    court: CourtWithDetails,
    start: Date,
    count: number,
  ): { first: Slot; last: Slot } {
    const date = localDate(start, this.utcOffset);
    for (const day of [date, previousDate(date)]) {
      const slots = daySlots(
        day,
        court.schedules,
        court.slotDuration,
        this.utcOffset,
      );
      const index = slots.findIndex(
        (s) => s.start.getTime() === start.getTime(),
      );
      if (index === -1) continue;
      if (index + count > slots.length) {
        throw new BadRequestException(
          `No hay ${count} turnos seguidos desde ese inicio: la cancha cierra antes`,
        );
      }
      return { first: slots[index], last: slots[index + count - 1] };
    }
    throw new BadRequestException(
      'El inicio no coincide con ningún turno de la cancha (consulta la disponibilidad)',
    );
  }

  private async paymentData(
    input: NonNullable<CreateReservationDto['payment']>,
    totalPrice: number,
  ) {
    if (input.amount > totalPrice) {
      throw new BadRequestException(
        `El pago no puede superar el total de la reserva (${totalPrice})`,
      );
    }
    const method = await this.catalogs.resolvePaymentMethod(
      input.method ?? DEFAULT_PAYMENT_METHOD,
    );
    // La referencia es opcional: se guarda si el método la pide y la envían.
    const reference = input.reference?.trim() || null;
    return {
      amount: input.amount,
      methodId: method.id,
      concept:
        input.amount === totalPrice
          ? PaymentConcept.TOTAL
          : PaymentConcept.ANTICIPO,
      reference: method.requiresReference ? reference : null,
      note: input.note,
      // Lo registra el negocio: queda aprobado de inmediato.
      status: PaymentStatus.APPROVED,
      registeredByBusiness: true,
    };
  }
}

const SPORT_LABELS: Record<Sport, string> = {
  FUTBOL: 'fútbol',
  PADEL: 'pádel',
  BALONCESTO: 'baloncesto',
  VOLEIBOL: 'voleibol',
};

function isComplete(court: CourtWithDetails): boolean {
  return REQUIRED_PHOTOS.every((slot) =>
    court.photos.some((p) => p.slot === slot),
  );
}

async function isTaken(
  tx: Prisma.TransactionClient,
  courtId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const overlapping = await tx.reservation.findFirst({
    where: {
      courtId,
      status: { in: BLOCKING_STATUSES },
      start: { lt: end },
      end: { gt: start },
    },
    select: { id: true },
  });
  return overlapping !== null;
}

/** Por qué ya no se puede reservar un turno, o null si todavía se puede. */
function lateBookingError(slot: Range, now: Date): string | null {
  if (slot.end <= now) return 'Ese turno ya pasó';
  if (slot.start.getTime() < now.getTime() - LATE_BOOKING_MINUTES * 60_000) {
    return `Ese turno empezó hace más de ${LATE_BOOKING_MINUTES} minutos`;
  }
  return null;
}

function assertBookable(court: CourtWithDetails): void {
  if (!court.isActive) {
    throw new ConflictException('La cancha está desactivada');
  }
  const missing = REQUIRED_PHOTOS.filter(
    (slot) => !court.photos.some((p) => p.slot === slot),
  );
  if (missing.length) {
    throw new ConflictException(
      `La cancha está incompleta: le faltan las fotos ${missing.join(', ')}`,
    );
  }
}

function courtRates(court: CourtWithDetails) {
  return court.rates.map((r) => ({
    ...r,
    pricePerHour: Number(r.pricePerHour),
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toReservationDto(r: ReservationWithRelations): ReservationDto {
  const totalPrice = Number(r.totalPrice);
  const consumptionsTotal = Number(r.consumptionsTotal);
  const amountPaid = round2(
    r.payments
      .filter((p) => p.status === PaymentStatus.APPROVED)
      .reduce((sum, p) => sum + Number(p.amount), 0),
  );
  return {
    id: r.id,
    courtId: r.courtId,
    courtName: r.court.name,
    sport: r.court.sport,
    start: r.start,
    end: r.end,
    customer: r.customer ? toCustomerDto(r.customer) : null,
    customerName: r.customerName,
    customerDetail: r.customerDetail,
    phone: r.phone,
    contactNote: r.contactNote,
    tag: r.tag,
    isRecurring: r.isRecurring,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    totalPrice,
    consumptionsTotal,
    currency: r.court.currency,
    amountPaid,
    balance: round2(totalPrice + consumptionsTotal - amountPaid),
    consumptions: r.sales.map(toSaleDto),
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method.code,
      concept: p.concept,
      status: p.status,
      reference: p.reference,
      receivedAt: p.receivedAt,
    })),
    status: r.status,
    source: r.source,
    cancellationReason: r.cancellationReason,
    cancelledAt: r.cancelledAt,
    cancelledBy: r.cancelledBy?.displayName ?? null,
    group: r.group ? toGroupDto(r.group) : null,
  };
}

function toGroupDto(
  group: NonNullable<ReservationWithRelations['group']>,
): ReservationDto['group'] {
  const totalPrice = round2(
    group.reservations.reduce((sum, m) => sum + Number(m.totalPrice), 0),
  );
  const consumptionsTotal = round2(
    group.reservations.reduce((sum, m) => sum + Number(m.consumptionsTotal), 0),
  );
  const amountPaid = round2(
    group.reservations
      .flatMap((m) => m.payments)
      .filter((p) => p.status === PaymentStatus.APPROVED)
      .reduce((sum, p) => sum + Number(p.amount), 0),
  );
  return {
    id: group.id,
    courts: group.reservations.map((m) => ({
      reservationId: m.id,
      courtId: m.courtId,
      courtName: m.court.name,
    })),
    totalPrice,
    consumptionsTotal,
    amountPaid,
    balance: round2(totalPrice + consumptionsTotal - amountPaid),
  };
}
