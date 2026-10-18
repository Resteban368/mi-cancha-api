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
import { Prisma, type User } from '../generated/prisma/client.js';
import {
  CourtPhotoSlot,
  PaymentConcept,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  type Sport,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AvailabilityDto,
  CancelReservationDto,
  CreateReservationDto,
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

/** Reglas de las reservas hechas por jugadores desde la web. */
export interface WebBookingRules {
  minAdvanceMinutes: number;
  maxDaysAhead: number;
  maxReservationsPerDay: number;
}

const reservationInclude = {
  court: { select: { name: true, sport: true, currency: true } },
  customer: true,
  cancelledBy: { select: { displayName: true } },
  payments: {
    include: { method: { select: { code: true } } },
    orderBy: { receivedAt: 'asc' },
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
    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: dto.status },
      include: reservationInclude,
    });
    return toReservationDto(updated);
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
    const booked = await this.bookedRanges(
      courts.map((c) => c.id),
      [...daySlotsByCourt.values()].flat(),
    );

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

  private slotsWithStatus(
    court: CourtWithDetails,
    slots: Slot[],
    booked: { start: Date; end: Date }[],
    now: Date,
  ): SlotDto[] {
    const rates = courtRates(court);
    const base = Number(court.basePricePerHour);
    return slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      status: booked.some((r) => r.start < slot.end && r.end > slot.start)
        ? 'BOOKED'
        : slot.end <= now
          ? 'PAST'
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
    if (!dto.courtId === !dto.sport) {
      throw new BadRequestException(
        'Envía courtId (una cancha) o sport (cualquier cancha libre de ese deporte), uno de los dos',
      );
    }
    const start = new Date(dto.start);

    // Serializable evita que dos reservas simultáneas tomen el mismo turno.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const { court, first, last } = dto.courtId
          ? await this.claimCourt(
              tx,
              businessId,
              dto.courtId,
              start,
              dto.slots,
              now,
            )
          : await this.claimAnyCourt(
              tx,
              businessId,
              dto.sport!,
              start,
              dto.slots,
              now,
            );

        const subtotal = priceFor(
          reservationIntervals(first.start, last.end, this.utcOffset),
          Number(court.basePricePerHour),
          courtRates(court),
        );
        const discount = dto.discount ?? 0;
        if (discount > subtotal) {
          throw new BadRequestException(
            `El descuento no puede superar el valor de la reserva (${subtotal})`,
          );
        }
        const totalPrice = round2(subtotal - discount);
        const payment = dto.payment
          ? await this.paymentData(dto.payment, totalPrice)
          : null;

        const customer = await this.customers.resolve(tx, businessId, dto);
        return tx.reservation.create({
          data: {
            businessId,
            courtId: court.id,
            customerId: customer.id,
            start: first.start,
            end: last.end,
            customerName: customer.name,
            phone: customer.phone,
            customerDetail: dto.customerDetail,
            contactNote: dto.contactNote,
            tag: dto.tag,
            isRecurring: dto.isRecurring ?? false,
            subtotal,
            discount,
            totalPrice,
            ...(payment && {
              payments: {
                create: {
                  ...payment,
                  businessId,
                  customerName: customer.name,
                },
              },
            }),
          },
          include: reservationInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toReservationDto(reservation);
  }

  /**
   * Reserva hecha por un jugador desde la web del negocio: queda confirmada,
   * sin pago (se paga en efectivo en la sede) y con origen WEB. Además de las
   * reglas del negocio aplica anticipación mínima y máxima y un tope diario.
   */
  async createWebReservation(
    businessId: string,
    player: User,
    input: { courtId: string; start: string; slots: number; notes?: string },
    rules: WebBookingRules,
    now = new Date(),
  ): Promise<ReservationDto> {
    const start = new Date(input.start);
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const { court, first, last } = await this.claimCourt(
          tx,
          businessId,
          input.courtId,
          start,
          input.slots,
          now,
        );
        if (
          first.start.getTime() <
          now.getTime() + rules.minAdvanceMinutes * 60_000
        ) {
          throw new BadRequestException(
            `Reserva con al menos ${rules.minAdvanceMinutes} minutos de anticipación`,
          );
        }
        if (
          first.start.getTime() >
          now.getTime() + rules.maxDaysAhead * DAY_MS
        ) {
          throw new BadRequestException(
            `Solo se puede reservar hasta ${rules.maxDaysAhead} días adelante`,
          );
        }

        const customer = await this.customers.resolveForPlayer(
          tx,
          businessId,
          player,
        );
        const day = dayRange(
          localDate(first.start, this.utcOffset),
          this.utcOffset,
        );
        const sameDay = await tx.reservation.count({
          where: {
            businessId,
            customerId: customer.id,
            status: { not: ReservationStatus.CANCELLED },
            start: { gte: day.from, lt: day.to },
          },
        });
        if (sameDay >= rules.maxReservationsPerDay) {
          throw new ConflictException(
            `Puedes tener máximo ${rules.maxReservationsPerDay} reservas por día en esta sede`,
          );
        }

        const subtotal = priceFor(
          reservationIntervals(first.start, last.end, this.utcOffset),
          Number(court.basePricePerHour),
          courtRates(court),
        );
        return tx.reservation.create({
          data: {
            businessId,
            courtId: court.id,
            customerId: customer.id,
            playerId: player.id,
            source: ReservationSource.WEB,
            start: first.start,
            end: last.end,
            customerName: customer.name,
            phone: customer.phone,
            contactNote: input.notes?.trim() || null,
            subtotal,
            discount: 0,
            totalPrice: subtotal,
          },
          include: reservationInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toReservationDto(reservation);
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
        include: { payments: true },
      });
      if (!current) throw new NotFoundException('La reserva no existe');
      if (current.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException(
          'Solo se pueden cancelar reservas confirmadas',
        );
      }

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

      return tx.reservation.update({
        where: { id: current.id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledById: actorId,
        },
        include: reservationInclude,
      });
    });
    return toReservationDto(reservation);
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
    if (last.end <= now) throw new BadRequestException('Ese turno ya pasó');
    if (await isTaken(tx, court.id, first.start, last.end)) {
      throw new ConflictException('La cancha ya está reservada en ese horario');
    }
    return { court, first, last };
  }

  /**
   * La primera cancha reservable del deporte (por nombre) que tenga un turno que
   * empiece en `start` y `count` turnos seguidos libres.
   */
  private async claimAnyCourt(
    tx: Prisma.TransactionClient,
    businessId: string,
    sport: Sport,
    start: Date,
    count: number,
    now: Date,
  ): Promise<{ court: CourtWithDetails; first: Slot; last: Slot }> {
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
    for (const court of courts) {
      let range: { first: Slot; last: Slot };
      try {
        range = this.findSlots(court, start, count);
      } catch {
        continue; // esta cancha no tiene ese turno o cierra antes
      }
      matched = true;
      if (range.last.end <= now)
        throw new BadRequestException('Ese turno ya pasó');
      if (!(await isTaken(tx, court.id, range.first.start, range.last.end))) {
        return { court, ...range };
      }
    }
    if (!matched) {
      throw new BadRequestException(
        `Ninguna cancha de ${SPORT_LABELS[sport]} tiene ${count} turno(s) seguidos desde ese inicio (consulta la disponibilidad)`,
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
    const reference = input.reference?.trim() || null;
    if (method.requiresReference && !reference) {
      throw new BadRequestException(
        `El pago con ${method.name} requiere el número de referencia`,
      );
    }
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
    currency: r.court.currency,
    amountPaid,
    balance: round2(totalPrice - amountPaid),
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
  };
}
