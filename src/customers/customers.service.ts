import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import {
  PaymentStatus,
  ReservationStatus,
  type Sport,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  computeMetrics,
  type CustomerMetrics,
  NEW_CUSTOMER_DAYS,
  type ReservationForMetrics,
} from './customer-metrics.js';
import {
  CreateCustomerDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerInputDto,
  CustomerMetricsDto,
  CustomerPageDto,
  CustomersOverviewDto,
  type CustomerSort,
  UpdateCustomerDto,
  CustomerPaymentItemDto,
  CustomerQueryDto,
  CustomerRefundItemDto,
  CustomerReservationItemDto,
  CustomerSummaryDto,
} from './dto/customer.dto.js';

const SEARCH_LIMIT = 20;

/** Cliente de un tx de Prisma o del cliente normal. */
type Db = Pick<Prisma.TransactionClient, 'customer'>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Busca por nombre, teléfono o cédula; sin búsqueda devuelve los más recientes. */
  async search(businessId: string, search?: string): Promise<CustomerDto[]> {
    const term = search?.trim();
    const digits = term?.replace(/\D/g, '');
    const customers = await this.prisma.customer.findMany({
      where: {
        businessId,
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            ...(digits
              ? [
                  { phone: { contains: digits } },
                  { documentId: { contains: normalizeDocument(term) } },
                ]
              : []),
          ],
        }),
      },
      orderBy: term ? { name: 'asc' } : { createdAt: 'desc' },
      take: SEARCH_LIMIT,
    });
    return customers.map(toCustomerDto);
  }

  /**
   * Listado de la cartera con métricas de fidelidad, filtros, orden y página,
   * más el resumen de toda la cartera para las tarjetas superiores.
   */
  async findPaginated(
    businessId: string,
    query: CustomerQueryDto,
    now = new Date(),
  ): Promise<CustomerPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [customers, court] = await Promise.all([
      this.prisma.customer.findMany({
        where: { businessId },
        include: { reservations: { select: reservationMetricsSelect } },
      }),
      this.prisma.court.findFirst({
        where: { businessId },
        select: { currency: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const all: CustomerSummaryDto[] = customers.map((c) =>
      toSummaryDto(c, computeMetrics(c.reservations.map(toMetricsInput), now)),
    );

    const newSince = addDays(now, -NEW_CUSTOMER_DAYS);
    const term = query.search?.trim().toLowerCase();
    const digits = term?.replace(/\D/g, '');
    const document = term && normalizeDocument(term);
    const segment = query.segment ?? 'ALL';
    const filtered = all.filter((c) => {
      if (
        term &&
        !c.name.toLowerCase().includes(term) &&
        !(digits && c.phone.includes(digits)) &&
        !(digits && document && c.documentId.includes(document))
      ) {
        return false;
      }
      switch (segment) {
        case 'LOYAL':
          return c.metrics.level === 'FREQUENT' || c.metrics.level === 'VIP';
        case 'WITH_BALANCE':
          return c.metrics.balance > 0;
        case 'NEW':
          return c.createdAt >= newSince;
        default:
          return true;
      }
    });
    filtered.sort(SORTERS[query.sort ?? 'MOST_RESERVATIONS']);

    return {
      overview: overviewOf(all, now, court?.currency ?? 'COP'),
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /** Alta de un cliente sin reserva. Teléfono y cédula no se pueden repetir. */
  async create(
    businessId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    const phone = normalizePhone(dto.phone);
    const documentId = normalizeDocument(dto.documentId);
    await this.assertUnique(businessId, { phone, documentId });
    const customer = await this.prisma.customer.create({
      data: {
        businessId,
        name: dto.name.trim(),
        phone,
        documentId,
        preferredSport: dto.preferredSport ?? null,
        notes: cleanNotes(dto.notes),
      },
    });
    return toCustomerDto(customer);
  }

  async update(
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    const current = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!current) throw new NotFoundException('El cliente no existe');

    const phone =
      dto.phone === undefined ? undefined : normalizePhone(dto.phone);
    const documentId =
      dto.documentId === undefined
        ? undefined
        : normalizeDocument(dto.documentId);
    await this.assertUnique(businessId, { phone, documentId }, current.id);

    const customer = await this.prisma.customer.update({
      where: { id: current.id },
      data: {
        name: dto.name?.trim(),
        phone,
        documentId,
        ...(dto.preferredSport !== undefined && {
          preferredSport: dto.preferredSport,
        }),
        ...(dto.notes !== undefined && { notes: cleanNotes(dto.notes) }),
      },
    });
    return toCustomerDto(customer);
  }

  private async assertUnique(
    businessId: string,
    { phone, documentId }: { phone?: string; documentId?: string },
    exceptId?: string,
  ): Promise<void> {
    const [byPhone, byDocument] = await Promise.all([
      phone
        ? this.prisma.customer.findUnique({
            where: { businessId_phone: { businessId, phone } },
          })
        : null,
      documentId
        ? this.prisma.customer.findUnique({
            where: { businessId_documentId: { businessId, documentId } },
          })
        : null,
    ]);
    if (byPhone && byPhone.id !== exceptId) {
      throw new ConflictException(
        `Ya existe un cliente con ese teléfono: ${byPhone.name}`,
      );
    }
    if (byDocument && byDocument.id !== exceptId) {
      throw new ConflictException(
        `Ya existe un cliente con esa cédula: ${byDocument.name}`,
      );
    }
  }

  /** Ficha completa del cliente con todas sus reservas y pagos en detalle. */
  async findOneDetail(
    businessId: string,
    customerId: string,
  ): Promise<CustomerDetailDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('El cliente no existe');

    const [reservations, payments] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { businessId, customerId },
        include: {
          court: {
            select: { id: true, name: true, sport: true, currency: true },
          },
          cancelledBy: { select: { displayName: true } },
          payments: {
            include: {
              method: { select: { code: true } },
              refund: {
                include: { createdBy: { select: { displayName: true } } },
              },
            },
            orderBy: { receivedAt: 'asc' },
          },
          refunds: {
            include: {
              createdBy: { select: { displayName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { start: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: {
          businessId,
          OR: [{ reservation: { customerId } }, { refund: { customerId } }],
        },
        include: {
          method: { select: { code: true } },
          reservation: {
            select: {
              id: true,
              start: true,
              end: true,
              court: { select: { name: true } },
            },
          },
          refund: {
            include: {
              createdBy: { select: { displayName: true } },
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    let confirmedReservations = 0;
    let completedReservations = 0;
    let cancelledReservations = 0;
    let noShowReservations = 0;

    for (const r of reservations) {
      if (r.status === ReservationStatus.CONFIRMED) confirmedReservations++;
      else if (r.status === ReservationStatus.COMPLETED)
        completedReservations++;
      else if (r.status === ReservationStatus.CANCELLED)
        cancelledReservations++;
      else if (r.status === ReservationStatus.NO_SHOW) noShowReservations++;
    }

    let totalSpent = 0;
    let pendingPayments = 0;
    for (const p of payments) {
      if (p.status === PaymentStatus.APPROVED) {
        totalSpent += Number(p.amount);
      } else if (p.status === PaymentStatus.PENDING) {
        pendingPayments++;
      }
    }

    let totalRefunded = 0;
    for (const r of reservations) {
      for (const ref of r.refunds) {
        totalRefunded += Number(ref.amount);
      }
    }

    const reservationDtos: CustomerReservationItemDto[] = reservations.map(
      (r) => ({
        id: r.id,
        courtId: r.court.id,
        courtName: r.court.name,
        sport: r.court.sport,
        currency: r.court.currency,
        start: r.start,
        end: r.end,
        customerName: r.customerName,
        customerDetail: r.customerDetail,
        phone: r.phone,
        contactNote: r.contactNote,
        tag: r.tag,
        isRecurring: r.isRecurring,
        subtotal: Number(r.subtotal),
        discount: Number(r.discount),
        totalPrice: Number(r.totalPrice),
        status: r.status,
        cancellationReason: r.cancellationReason,
        cancelledAt: r.cancelledAt,
        cancelledByName: r.cancelledBy?.displayName ?? null,
        createdAt: r.createdAt,
        payments: r.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method.code,
          concept: p.concept,
          status: p.status,
          reference: p.reference,
          note: p.note,
          rejectionReason: p.rejectionReason,
          registeredByBusiness: p.registeredByBusiness,
          receivedAt: p.receivedAt,
          reservationId: r.id,
          courtName: r.court.name,
          reservationStart: r.start,
          reservationEnd: r.end,
          refund: p.refund
            ? {
                id: p.refund.id,
                amount: Number(p.refund.amount),
                reason: p.refund.reason,
                createdAt: p.refund.createdAt,
                createdBy: p.refund.createdBy?.displayName ?? null,
              }
            : null,
        })),
        refunds: r.refunds.map((ref): CustomerRefundItemDto => ({
          id: ref.id,
          amount: Number(ref.amount),
          reason: ref.reason,
          createdAt: ref.createdAt,
          createdBy: ref.createdBy?.displayName ?? null,
        })),
      }),
    );

    const paymentDtos: CustomerPaymentItemDto[] = payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method.code,
      concept: p.concept,
      status: p.status,
      reference: p.reference,
      note: p.note,
      rejectionReason: p.rejectionReason,
      registeredByBusiness: p.registeredByBusiness,
      receivedAt: p.receivedAt,
      reservationId: p.reservationId ?? p.reservation?.id ?? null,
      courtName: p.reservation?.court?.name ?? null,
      reservationStart: p.reservation?.start ?? null,
      reservationEnd: p.reservation?.end ?? null,
      refund: p.refund
        ? {
            id: p.refund.id,
            amount: Number(p.refund.amount),
            reason: p.refund.reason,
            createdAt: p.refund.createdAt,
            createdBy: p.refund.createdBy?.displayName ?? null,
          }
        : null,
    }));

    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      phone: customer.phone,
      documentId: customer.documentId,
      preferredSport: customer.preferredSport,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      metrics: metricsDto(
        customer,
        computeMetrics(
          reservations.map((r) =>
            toMetricsInput({
              ...r,
              court: { name: r.court.name, sport: r.court.sport },
            }),
          ),
        ),
      ),
      stats: {
        totalReservations: reservations.length,
        confirmedReservations,
        completedReservations,
        cancelledReservations,
        noShowReservations,
        totalSpent,
        pendingPayments,
        totalRefunded,
      },
      reservations: reservationDtos,
      payments: paymentDtos,
    };
  }

  /**
   * Cliente de la reserva: el indicado por id, o el que ya tenga ese teléfono o
   * esa cédula (se conservan sus datos), o uno nuevo.
   */
  async resolve(
    db: Db,
    businessId: string,
    input: { customerId?: string; customer?: CustomerInputDto },
  ): Promise<Customer> {
    if (input.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: input.customerId, businessId },
      });
      if (!customer) throw new NotFoundException('El cliente no existe');
      return customer;
    }

    const data = input.customer!;
    const phone = normalizePhone(data.phone);
    const documentId = normalizeDocument(data.documentId);
    const [byPhone, byDocument] = await Promise.all([
      db.customer.findUnique({
        where: { businessId_phone: { businessId, phone } },
      }),
      db.customer.findUnique({
        where: { businessId_documentId: { businessId, documentId } },
      }),
    ]);
    if (byPhone && byDocument && byPhone.id !== byDocument.id) {
      throw new ConflictException(
        `El teléfono es de ${byPhone.name} y la cédula de ${byDocument.name}: revisa los datos del cliente`,
      );
    }
    const existing = byPhone ?? byDocument;
    if (existing) return existing;

    return db.customer.create({
      data: { businessId, name: data.name.trim(), phone, documentId },
    });
  }
}

/** Solo dígitos y el + inicial; 10 dígitos sin indicativo se toman de Colombia (+57). */
export function normalizePhone(phone: string): string {
  const clean = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return /^\d{10}$/.test(clean) ? `+57${clean}` : clean;
}

export function normalizeDocument(document: string): string {
  return document.replace(/[.\s-]/g, '').toUpperCase();
}

export function toCustomerDto(c: Customer): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    documentId: c.documentId,
    preferredSport: c.preferredSport,
    notes: c.notes,
    createdAt: c.createdAt,
  };
}

const reservationMetricsSelect = {
  status: true,
  start: true,
  totalPrice: true,
  court: { select: { name: true, sport: true } },
  payments: { select: { amount: true, status: true } },
} satisfies Prisma.ReservationSelect;

function toMetricsInput(r: {
  status: ReservationStatus;
  start: Date;
  totalPrice: Prisma.Decimal | number;
  court: { name: string; sport: Sport };
  payments: { amount: Prisma.Decimal | number; status: PaymentStatus }[];
}): ReservationForMetrics {
  return {
    status: r.status,
    start: r.start,
    totalPrice: Number(r.totalPrice),
    courtName: r.court.name,
    sport: r.court.sport,
    payments: r.payments.map((p) => ({
      amount: Number(p.amount),
      status: p.status,
    })),
  };
}

function metricsDto(c: Customer, m: CustomerMetrics): CustomerMetricsDto {
  return {
    reservations: m.reservations,
    level: m.level,
    attendancePct: m.attendancePct,
    totalSpent: m.totalSpent,
    balance: m.balance,
    lastVisit: m.lastVisit,
    favoriteSport: c.preferredSport ?? m.mostPlayedSport,
  };
}

function toSummaryDto(c: Customer, m: CustomerMetrics): CustomerSummaryDto {
  return { ...toCustomerDto(c), metrics: metricsDto(c, m) };
}

const SORTERS: Record<
  CustomerSort,
  (a: CustomerSummaryDto, b: CustomerSummaryDto) => number
> = {
  MOST_RESERVATIONS: (a, b) =>
    b.metrics.reservations - a.metrics.reservations || byName(a, b),
  TOP_SPENDERS: (a, b) =>
    b.metrics.totalSpent - a.metrics.totalSpent || byName(a, b),
  LAST_VISIT: (a, b) =>
    (b.metrics.lastVisit?.date.getTime() ?? 0) -
      (a.metrics.lastVisit?.date.getTime() ?? 0) || byName(a, b),
  HIGHEST_BALANCE: (a, b) =>
    b.metrics.balance - a.metrics.balance || byName(a, b),
  NAME: byName,
  NEWEST: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
};

function byName(a: CustomerSummaryDto, b: CustomerSummaryDto): number {
  return a.name.localeCompare(b.name, 'es');
}

function overviewOf(
  all: CustomerSummaryDto[],
  now: Date,
  currency: string,
): CustomersOverviewDto {
  const thisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const newThisMonth = all.filter((c) => c.createdAt >= thisMonth).length;
  const newLastMonth = all.filter(
    (c) => c.createdAt >= lastMonth && c.createdAt < thisMonth,
  ).length;
  const loyal = all.filter(
    (c) => c.metrics.level === 'FREQUENT' || c.metrics.level === 'VIP',
  ).length;
  return {
    totalCustomers: all.length,
    newThisMonth,
    newVsLastMonthPct: newLastMonth
      ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
      : null,
    loyalCustomers: loyal,
    loyalPct: all.length ? Math.round((loyal / all.length) * 100) : 0,
    totalReservations: all.reduce((sum, c) => sum + c.metrics.reservations, 0),
    pendingBalance:
      Math.round(all.reduce((sum, c) => sum + c.metrics.balance, 0) * 100) /
      100,
    currency,
  };
}

function cleanNotes(notes: string | null | undefined): string | null {
  return notes?.trim() || null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
