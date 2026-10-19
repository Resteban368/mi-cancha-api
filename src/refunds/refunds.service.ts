import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../generated/prisma/client.js';
import { PaymentConcept } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class RefundDto {
  id: string;
  amount: number;
  currency: string;
  /** Motivo de la cancelación. */
  reason: string;
  createdAt: Date;
  /** Quién canceló la reserva. */
  createdBy: string | null;
  reservation: { id: string; courtName: string; start: Date; end: Date };
  payment: {
    id: string;
    /** Código del método de pago. */
    method: string;
    methodName: string;
    concept: PaymentConcept;
    reference: string | null;
    receivedAt: Date;
  };
  @ApiProperty({ nullable: true })
  customer: {
    id: string;
    name: string;
    phone: string;
    documentId: string | null;
  } | null;
}

const refundInclude = {
  createdBy: { select: { displayName: true } },
  customer: true,
  reservation: {
    select: {
      id: true,
      start: true,
      end: true,
      court: { select: { name: true, currency: true } },
    },
  },
  payment: { include: { method: { select: { code: true, name: true } } } },
} satisfies Prisma.RefundInclude;

const REFUND_LIMIT = 200;

/** Devoluciones generadas al cancelar reservas con pagos aprobados. */
@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForBusiness(businessId: string): Promise<RefundDto[]> {
    const refunds = await this.prisma.refund.findMany({
      where: { businessId },
      include: refundInclude,
      orderBy: { createdAt: 'desc' },
      take: REFUND_LIMIT,
    });
    return refunds.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.reservation.court.currency,
      reason: r.reason,
      createdAt: r.createdAt,
      createdBy: r.createdBy?.displayName ?? null,
      reservation: {
        id: r.reservation.id,
        courtName: r.reservation.court.name,
        start: r.reservation.start,
        end: r.reservation.end,
      },
      payment: {
        id: r.payment.id,
        method: r.payment.method.code,
        methodName: r.payment.method.name,
        concept: r.payment.concept,
        reference: r.payment.reference,
        receivedAt: r.payment.receivedAt,
      },
      customer: r.customer && {
        id: r.customer.id,
        name: r.customer.name,
        phone: r.customer.phone,
        documentId: r.customer.documentId,
      },
    }));
  }
}
