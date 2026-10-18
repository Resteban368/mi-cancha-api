import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PaymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePaymentDto,
  PaymentDto,
  RejectPaymentDto,
} from './dto/payment.dto.js';

const paymentInclude = {
  method: { select: { code: true } },
  reservation: {
    select: { start: true, court: { select: { name: true } } },
  },
} satisfies Prisma.PaymentInclude;

type PaymentWithReservation = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly catalogs: CatalogsService,
  ) {}

  async findAll(
    ownerId: string,
    status?: PaymentStatus,
  ): Promise<PaymentDto[]> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    const payments = await this.prisma.payment.findMany({
      where: { businessId, status },
      include: paymentInclude,
      orderBy: { receivedAt: 'desc' },
    });
    return payments.map(toPaymentDto);
  }

  /** Pago registrado por el propio negocio: queda aprobado de inmediato. */
  async create(ownerId: string, dto: CreatePaymentDto): Promise<PaymentDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    if (dto.reservationId) {
      const reservation = await this.prisma.reservation.findFirst({
        where: { id: dto.reservationId, businessId },
        select: { id: true },
      });
      if (!reservation) throw new NotFoundException('La reserva no existe');
    }

    const method = await this.catalogs.resolvePaymentMethod(dto.method);
    // La referencia es opcional: se guarda si el método la pide y la envían.
    const reference = dto.reference?.trim() || null;

    const payment = await this.prisma.payment.create({
      data: {
        businessId,
        reservationId: dto.reservationId,
        customerName: dto.customerName,
        amount: dto.amount,
        methodId: method.id,
        concept: dto.concept,
        reference: method.requiresReference ? reference : null,
        note: dto.note,
        status: PaymentStatus.APPROVED,
        registeredByBusiness: true,
      },
      include: paymentInclude,
    });
    return toPaymentDto(payment);
  }

  approve(ownerId: string, paymentId: string): Promise<PaymentDto> {
    return this.resolvePending(ownerId, paymentId, {
      status: PaymentStatus.APPROVED,
    });
  }

  reject(
    ownerId: string,
    paymentId: string,
    dto: RejectPaymentDto,
  ): Promise<PaymentDto> {
    return this.resolvePending(ownerId, paymentId, {
      status: PaymentStatus.REJECTED,
      rejectionReason: dto.reason,
    });
  }

  private async resolvePending(
    ownerId: string,
    paymentId: string,
    data: Prisma.PaymentUpdateManyMutationInput,
  ): Promise<PaymentDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    // updateMany con el estado en el filtro evita aprobar dos veces en paralelo.
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, businessId, status: PaymentStatus.PENDING },
      data,
    });
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('El pago no existe');
    if (count === 0) {
      throw new ConflictException('El pago ya fue validado');
    }
    return toPaymentDto(payment);
  }
}

function toPaymentDto(p: PaymentWithReservation): PaymentDto {
  return {
    id: p.id,
    customerName: p.customerName,
    amount: Number(p.amount),
    method: p.method.code,
    concept: p.concept,
    receivedAt: p.receivedAt,
    status: p.status,
    reservationId: p.reservationId,
    courtName: p.reservation?.court.name ?? null,
    reservationStart: p.reservation?.start ?? null,
    reference: p.reference,
    note: p.note,
    rejectionReason: p.rejectionReason,
    registeredByBusiness: p.registeredByBusiness,
  };
}
