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

const reservationInclude = {
  court: { select: { name: true, sport: true } },
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

    // Serializable evita que dos reservas simultáneas pasen la validación de cruce.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const court = await tx.court.findFirst({
          where: { id: dto.courtId, businessId },
        });
        if (!court) throw new NotFoundException('La cancha no existe');
        if (!court.active) {
          throw new ConflictException('La cancha está desactivada');
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

        const hours = (end.getTime() - start.getTime()) / 3_600_000;
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
            totalPrice: dto.totalPrice ?? Math.round(court.hourlyPrice * hours),
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
    totalPrice: r.totalPrice,
    amountPaid: r.payments.reduce((sum, p) => sum + p.amount, 0),
    status: r.status,
  };
}
