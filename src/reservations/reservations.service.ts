import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessesService } from '../businesses/businesses.service.js';
import { dayRange } from '../common/utils/day-range.js';
import { Prisma } from '../generated/prisma/client.js';
import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import {
  fitsSchedule,
  priceFor,
  reservationIntervals,
} from '../courts/court-time.js';
import { courtInclude, REQUIRED_PHOTOS } from '../courts/courts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateReservationDto,
  ReservationDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto.js';

/** Estados que ocupan la cancha en su horario. */
const BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
];

/** Una reserva no puede durar más de un día. */
const MAX_RESERVATION_MINUTES = 24 * 60;

const reservationInclude = {
  court: { select: { name: true, sport: true, currency: true } },
  payments: {
    where: { status: PaymentStatus.APPROVED },
    select: { amount: true },
  },
} satisfies Prisma.ReservationInclude;

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

@Injectable()
export class ReservationsService {
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  async findForDay(ownerId: string, date: string): Promise<ReservationDto[]> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const { from, to } = dayRange(date, this.utcOffset);
    const reservations = await this.prisma.reservation.findMany({
      where: { businessId, start: { gte: from, lt: to } },
      include: reservationInclude,
      orderBy: { start: 'asc' },
    });
    return reservations.map(toReservationDto);
  }

  async findOne(ownerId: string, id: string): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, businessId },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('La reserva no existe');
    return toReservationDto(reservation);
  }

  async create(
    ownerId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const start = new Date(dto.start);
    const end = new Date(dto.end);
    if (end <= start) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior al inicio',
      );
    }
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes > MAX_RESERVATION_MINUTES) {
      throw new BadRequestException(
        'Una reserva no puede durar más de 24 horas',
      );
    }

    // Serializable evita que dos reservas simultáneas pasen la validación de cruce.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const court = await tx.court.findFirst({
          where: { id: dto.courtId, businessId },
          include: courtInclude,
        });
        if (!court) throw new NotFoundException('La cancha no existe');
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
        if (minutes % court.slotDuration !== 0) {
          throw new BadRequestException(
            `La reserva debe durar múltiplos de ${court.slotDuration} minutos`,
          );
        }
        const interval = reservationIntervals(start, end, this.utcOffset);
        if (!fitsSchedule(interval, court.schedules)) {
          throw new BadRequestException(
            'La reserva está fuera del horario de la cancha',
          );
        }

        const overlapping = await tx.reservation.findFirst({
          where: {
            courtId: court.id,
            status: { in: BLOCKING_STATUSES },
            start: { lt: end },
            end: { gt: start },
          },
          select: { id: true },
        });
        if (overlapping) {
          throw new ConflictException(
            'La cancha ya está reservada en ese horario',
          );
        }

        return tx.reservation.create({
          data: {
            businessId,
            courtId: court.id,
            start,
            end,
            customerName: dto.customerName,
            customerDetail: dto.customerDetail,
            phone: dto.phone,
            contactNote: dto.contactNote,
            tag: dto.tag,
            isRecurring: dto.isRecurring ?? false,
            totalPrice:
              dto.totalPrice ??
              priceFor(
                interval,
                Number(court.basePricePerHour),
                court.rates.map((r) => ({
                  ...r,
                  pricePerHour: Number(r.pricePerHour),
                })),
              ),
          },
          include: reservationInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toReservationDto(reservation);
  }

  async updateStatus(
    ownerId: string,
    id: string,
    dto: UpdateReservationStatusDto,
  ): Promise<ReservationDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, businessId },
      select: { id: true, status: true },
    });
    if (!reservation) throw new NotFoundException('La reserva no existe');
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
}

function toReservationDto(r: ReservationWithRelations): ReservationDto {
  return {
    id: r.id,
    courtId: r.courtId,
    courtName: r.court.name,
    sport: r.court.sport,
    start: r.start,
    end: r.end,
    customerName: r.customerName,
    customerDetail: r.customerDetail,
    phone: r.phone,
    contactNote: r.contactNote,
    tag: r.tag,
    isRecurring: r.isRecurring,
    totalPrice: Number(r.totalPrice),
    currency: r.court.currency,
    amountPaid: r.payments.reduce((sum, p) => sum + p.amount, 0),
    status: r.status,
  };
}
