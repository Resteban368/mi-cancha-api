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
import { ensurePlayerAccount } from './customer-account.js';
import {
  type CustomerMetricsRow,
  lastVisitCourtsQuery,
  type ListParams,
  type OverviewRow,
  overviewQuery,
  pageQuery,
  sportsQuery,
} from './customers.query.js';
import {
  computeMetrics,
  levelFor,
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
  UpdateCustomerDto,
  CustomerPaymentItemDto,
  CustomerQueryDto,
  CustomerRefundItemDto,
  CustomerReservationItemDto,
} from './dto/customer.dto.js';

const SEARCH_LIMIT = 20;

/** Cliente de un tx de Prisma o del cliente normal. */
type Db = Pick<Prisma.TransactionClient, 'customer' | 'user'>;

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
    const term = query.search?.trim();
    const digits = term?.replace(/\D/g, '');
    const params: ListParams = {
      businessId,
      now,
      search: term || undefined,
      digits: digits || undefined,
      document: term ? normalizeDocument(term) : undefined,
      segment: query.segment ?? 'ALL',
      newSince: addDays(now, -NEW_CUSTOMER_DAYS),
      thisMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      lastMonth: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      ),
    };

    const [rows, [overview], court] = await Promise.all([
      this.prisma.$queryRaw<CustomerMetricsRow[]>(
        pageQuery(
          params,
          query.sort ?? 'MOST_RESERVATIONS',
          pageSize,
          (page - 1) * pageSize,
        ),
      ),
      this.prisma.$queryRaw<OverviewRow[]>(overviewQuery(params)),
      this.prisma.court.findFirst({
        where: { businessId },
        select: { currency: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const ids = rows.map((r) => r.id);
    const [courts, sports] = ids.length
      ? await Promise.all([
          this.prisma.$queryRaw<{ customerId: string; courtName: string }[]>(
            lastVisitCourtsQuery(ids, now),
          ),
          this.prisma.$queryRaw<
            { customerId: string; sport: Sport; count: number }[]
          >(sportsQuery(ids)),
        ])
      : [[], []];
    const courtByCustomer = new Map(
      courts.map((c) => [c.customerId, c.courtName]),
    );

    return {
      overview: {
        totalCustomers: overview.totalCustomers,
        newThisMonth: overview.newThisMonth,
        newVsLastMonthPct: overview.newLastMonth
          ? Math.round(
              ((overview.newThisMonth - overview.newLastMonth) /
                overview.newLastMonth) *
                100,
            )
          : null,
        loyalCustomers: overview.loyalCustomers,
        loyalPct: overview.totalCustomers
          ? Math.round(
              (overview.loyalCustomers / overview.totalCustomers) * 100,
            )
          : 0,
        totalReservations: overview.totalReservations,
        pendingBalance: round2(overview.pendingBalance),
        currency: court?.currency ?? 'COP',
      },
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        documentId: r.documentId,
        preferredSport: r.preferredSport as Sport | null,
        notes: r.notes,
        createdAt: r.createdAt,
        metrics: {
          reservations: r.reservations,
          level: levelFor(r.reservations),
          attendancePct:
            r.completed + r.noShow
              ? Math.round((r.completed / (r.completed + r.noShow)) * 100)
              : null,
          totalSpent: round2(r.totalSpent),
          balance: round2(r.balance),
          lastVisit: r.lastVisit
            ? { date: r.lastVisit, courtName: courtByCustomer.get(r.id) ?? '' }
            : null,
          favoriteSport:
            (r.preferredSport as Sport | null) ??
            mostPlayed(sports.filter((s) => s.customerId === r.id)),
        },
      })),
      total: overview.filtered,
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
    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          businessId,
          name: dto.name.trim(),
          phone,
          documentId,
          preferredSport: dto.preferredSport ?? null,
          notes: cleanNotes(dto.notes),
        },
      });
      return ensurePlayerAccount(tx, created);
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
   * Ficha de cliente del jugador en este negocio: la ya vinculada a su cuenta,
   * o la que el negocio había creado con su celular o cédula (se vincula y se
   * conservan sus datos), o una nueva con los datos de la cuenta.
   */
  async resolveForPlayer(
    db: Db,
    businessId: string,
    player: {
      id: string;
      displayName: string;
      phone: string | null;
      documentId: string | null;
      favoriteSport: Sport | null;
    },
  ): Promise<Customer> {
    const linked = await db.customer.findUnique({
      where: { businessId_userId: { businessId, userId: player.id } },
    });
    if (linked) return linked;

    const phone = player.phone ?? '';
    // Sin cédula (se registró solo con celular) se busca únicamente por celular.
    const documentId = player.documentId || null;
    const [byPhone, byDocument] = await Promise.all([
      db.customer.findUnique({
        where: { businessId_phone: { businessId, phone } },
      }),
      documentId
        ? db.customer.findUnique({
            where: { businessId_documentId: { businessId, documentId } },
          })
        : null,
    ]);
    if (byPhone && byDocument && byPhone.id !== byDocument.id) {
      throw new ConflictException(
        'Tu celular y tu cédula están registrados en esta sede como clientes distintos: comunícate con la sede',
      );
    }
    const existing = byPhone ?? byDocument;
    if (existing) {
      if (existing.userId) {
        throw new ConflictException(
          'Tu celular o tu cédula ya están vinculados a otra cuenta en esta sede: comunícate con la sede',
        );
      }
      return db.customer.update({
        where: { id: existing.id },
        data: { userId: player.id },
      });
    }
    return db.customer.create({
      data: {
        businessId,
        userId: player.id,
        name: player.displayName,
        phone,
        documentId,
        preferredSport: player.favoriteSport,
      },
    });
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

    const created = await db.customer.create({
      data: { businessId, name: data.name.trim(), phone, documentId },
    });
    return ensurePlayerAccount(db, created);
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

function toMetricsInput(r: {
  id?: string;
  groupId?: string | null;
  status: ReservationStatus;
  start: Date;
  totalPrice: Prisma.Decimal | number;
  consumptionsTotal?: Prisma.Decimal | number;
  court: { name: string; sport: Sport };
  payments: { amount: Prisma.Decimal | number; status: PaymentStatus }[];
}): ReservationForMetrics {
  return {
    id: r.id,
    groupId: r.groupId,
    status: r.status,
    start: r.start,
    // El saldo del cliente incluye los consumos cargados a la reserva.
    totalPrice: Number(r.totalPrice) + Number(r.consumptionsTotal ?? 0),
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

/** Deporte con más reservas; en empate, el primero alfabéticamente. */
function mostPlayed(rows: { sport: Sport; count: number }[]): Sport | null {
  const sorted = [...rows].sort(
    (a, b) => b.count - a.count || a.sport.localeCompare(b.sport),
  );
  return sorted[0]?.sport ?? null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function cleanNotes(notes: string | null | undefined): string | null {
  return notes?.trim() || null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
