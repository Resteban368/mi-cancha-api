import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import { Prisma, type CashSession } from '../generated/prisma/client.js';
import { PaymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CashCurrentDto,
  CashExpenseDto,
  CashMethodDto,
  CashSessionDto,
  CashSessionsQueryDto,
  CloseCashDto,
  CreateCashExpenseDto,
  CreateSupplierDto,
  OpenCashDto,
  SupplierDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
  VoidCashExpenseDto,
} from './dto/cash.dto.js';

/** Código del catálogo que cuenta como efectivo en la caja. */
export const CASH_METHOD = 'EFECTIVO';
/** Proveedores por negocio (la lista se manda completa a la app). */
export const MAX_SUPPLIERS = 300;

const expenseInclude = {
  method: { select: { code: true, name: true } },
} satisfies Prisma.CashExpenseInclude;

type ExpenseRecord = Prisma.CashExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

const sessionInclude = {
  expenses: { include: expenseInclude, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.CashSessionInclude;

type SessionRecord = Prisma.CashSessionGetPayload<{
  include: typeof sessionInclude;
}>;

/**
 * Turnos de caja del negocio: abrir con una base, ver lo cobrado por método,
 * pagar a proveedores y cerrar contando el efectivo (arqueo). Una sola caja
 * abierta a la vez.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly catalogs: CatalogsService,
  ) {}

  async current(ownerId: string, now = new Date()): Promise<CashCurrentDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const [open, lastClosed] = await Promise.all([
      this.prisma.cashSession.findFirst({
        where: { businessId, closedAt: null },
        include: sessionInclude,
      }),
      this.prisma.cashSession.findFirst({
        where: { businessId, closedAt: { not: null } },
        orderBy: { closedAt: 'desc' },
        include: sessionInclude,
      }),
    ]);
    return {
      session: open
        ? toDto(open, await this.methods(businessId, open.openedAt, now))
        : null,
      lastClosed: lastClosed ? toDto(lastClosed) : null,
    };
  }

  async open(ownerId: string, dto: OpenCashDto): Promise<CashSessionDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const name = await this.userName(ownerId);
    const open = await this.prisma.cashSession.findFirst({
      where: { businessId, closedAt: null },
      select: { id: true },
    });
    if (open) throw new ConflictException('Ya hay una caja abierta');
    // El índice único parcial cubre dos aperturas al mismo tiempo (P2002 → 409).
    const session = await this.prisma.cashSession.create({
      data: {
        businessId,
        openingCash: dto.openingCash,
        openingNote: dto.note || null,
        openedById: ownerId,
        openedByName: name,
      },
      include: sessionInclude,
    });
    return toDto(session, []);
  }

  async close(ownerId: string, dto: CloseCashDto): Promise<CashSessionDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const name = await this.userName(ownerId);
    const open = await this.prisma.cashSession.findFirst({
      where: { businessId, closedAt: null },
      include: sessionInclude,
    });
    if (!open) throw new ConflictException('No hay una caja abierta');

    const closedAt = new Date();
    const methods = await this.methods(businessId, open.openedAt, closedAt);
    const expected = expectedCash(
      Number(open.openingCash),
      methods,
      expenseTotals(open.expenses).cash,
    );
    // updateMany con closedAt null en el filtro evita cerrar dos veces.
    const { count } = await this.prisma.cashSession.updateMany({
      where: { id: open.id, closedAt: null },
      data: {
        closedAt,
        closedById: ownerId,
        closedByName: name,
        expectedCash: expected,
        countedCash: dto.countedCash,
        difference: round2(dto.countedCash - expected),
        closingNote: dto.note || null,
        summary: methods as unknown as Prisma.InputJsonValue,
      },
    });
    if (count === 0) throw new ConflictException('La caja ya fue cerrada');
    const closed = await this.prisma.cashSession.findUniqueOrThrow({
      where: { id: open.id },
      include: sessionInclude,
    });
    return toDto(closed);
  }

  async history(
    ownerId: string,
    query: CashSessionsQueryDto,
  ): Promise<Page<CashSessionDto>> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const where = { businessId, closedAt: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        include: sessionInclude,
        ...pageArgs(query),
      }),
      this.prisma.cashSession.count({ where }),
    ]);
    return {
      items: items.map((s) => toDto(s)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ---------- Pagos a proveedores ----------

  /** Registra un pago a un proveedor en la caja abierta. */
  async addExpense(
    ownerId: string,
    dto: CreateCashExpenseDto,
  ): Promise<CashExpenseDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const [open, supplier, method, name] = await Promise.all([
      this.prisma.cashSession.findFirst({
        where: { businessId, closedAt: null },
        select: { id: true },
      }),
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, businessId },
      }),
      this.catalogs.resolvePaymentMethod(dto.method),
      this.userName(ownerId),
    ]);
    if (!open) {
      throw new ConflictException(
        'Abre la caja para registrar pagos a proveedores',
      );
    }
    if (!supplier) throw new NotFoundException('El proveedor no existe');
    if (!supplier.isActive) {
      throw new ConflictException('El proveedor está desactivado');
    }
    const expense = await this.prisma.cashExpense.create({
      data: {
        businessId,
        sessionId: open.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount: dto.amount,
        methodId: method.id,
        concept: dto.concept,
        createdById: ownerId,
        createdByName: name,
      },
      include: expenseInclude,
    });
    return toExpenseDto(expense);
  }

  /** Anula un pago de la caja abierta (deja de restar al cerrar). */
  async voidExpense(
    ownerId: string,
    id: string,
    dto: VoidCashExpenseDto,
  ): Promise<CashExpenseDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const expense = await this.prisma.cashExpense.findFirst({
      where: { id, businessId },
      include: { session: { select: { closedAt: true } } },
    });
    if (!expense) throw new NotFoundException('El pago no existe');
    if (expense.session.closedAt) {
      throw new ConflictException(
        'La caja de ese pago ya se cerró: no se puede anular',
      );
    }
    const { count } = await this.prisma.cashExpense.updateMany({
      where: { id, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: dto.reason },
    });
    if (count === 0) throw new ConflictException('El pago ya fue anulado');
    return toExpenseDto(
      await this.prisma.cashExpense.findUniqueOrThrow({
        where: { id },
        include: expenseInclude,
      }),
    );
  }

  // ---------- Proveedores ----------

  async listSuppliers(
    ownerId: string,
    query: SuppliersQueryDto,
  ): Promise<SupplierDto[]> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        businessId,
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
      take: MAX_SUPPLIERS,
    });
    return suppliers.map(toSupplierDto);
  }

  async createSupplier(
    ownerId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    if (
      (await this.prisma.supplier.count({ where: { businessId } })) >=
      MAX_SUPPLIERS
    ) {
      throw new ConflictException(
        `Llegaste al máximo de ${MAX_SUPPLIERS} proveedores`,
      );
    }
    await this.assertSupplierNameFree(businessId, dto.name);
    const supplier = await this.prisma.supplier.create({
      data: {
        businessId,
        name: dto.name,
        documentId: dto.documentId || null,
        phone: dto.phone || null,
        notes: dto.notes || null,
      },
    });
    return toSupplierDto(supplier);
  }

  async updateSupplier(
    ownerId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const current = await this.prisma.supplier.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('El proveedor no existe');
    if (dto.name !== undefined) {
      await this.assertSupplierNameFree(businessId, dto.name, id);
    }
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        documentId:
          dto.documentId === undefined ? undefined : dto.documentId || null,
        phone: dto.phone === undefined ? undefined : dto.phone || null,
        notes: dto.notes === undefined ? undefined : dto.notes || null,
        isActive: dto.isActive,
      },
    });
    return toSupplierDto(supplier);
  }

  private async assertSupplierNameFree(
    businessId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const taken = await this.prisma.supplier.findFirst({
      where: {
        businessId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(`Ya tienes un proveedor llamado "${name}"`);
    }
  }

  /** Pagos aprobados recibidos en [from, to), por método, de mayor a menor. */
  private async methods(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<CashMethodDto[]> {
    const rows = await this.prisma.$queryRaw<CashMethodDto[]>(Prisma.sql`
      SELECT pm."code", pm."name", COUNT(*)::int AS "count",
        SUM(p."amount")::float8 AS "amount"
      FROM "Payment" p
      JOIN "PaymentMethod" pm ON pm."id" = p."methodId"
      WHERE p."businessId" = ${businessId}
        AND p."status" = ${PaymentStatus.APPROVED}::"PaymentStatus"
        AND p."receivedAt" >= ${from} AND p."receivedAt" < ${to}
      GROUP BY pm."code", pm."name"
      ORDER BY "amount" DESC, pm."name"`);
    return rows.map((r) => ({ ...r, amount: round2(r.amount) }));
  }

  private async userName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Base + cobros en efectivo − pagos a proveedores en efectivo. */
export function expectedCash(
  openingCash: number,
  methods: CashMethodDto[],
  cashExpenses = 0,
): number {
  const cash = methods.find((m) => m.code === CASH_METHOD)?.amount ?? 0;
  return round2(openingCash + cash - cashExpenses);
}

/** Pagos sin anular: total y la parte en efectivo. */
function expenseTotals(expenses: ExpenseRecord[]) {
  let total = 0;
  let cash = 0;
  for (const e of expenses) {
    if (e.voidedAt) continue;
    total += Number(e.amount);
    if (e.method.code === CASH_METHOD) cash += Number(e.amount);
  }
  return { total: round2(total), cash: round2(cash) };
}

function toExpenseDto(e: ExpenseRecord): CashExpenseDto {
  return {
    id: e.id,
    supplierId: e.supplierId,
    supplierName: e.supplierName,
    amount: Number(e.amount),
    method: e.method.code,
    methodName: e.method.name,
    concept: e.concept,
    createdAt: e.createdAt,
    createdByName: e.createdByName,
    voidedAt: e.voidedAt,
    voidReason: e.voidReason,
  };
}

function toSupplierDto(s: {
  id: string;
  name: string;
  documentId: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}): SupplierDto {
  return {
    id: s.id,
    name: s.name,
    documentId: s.documentId,
    phone: s.phone,
    notes: s.notes,
    isActive: s.isActive,
  };
}

/** Con [live] (caja abierta) los totales son hasta ahora; si no, los del cierre. */
function toDto(
  s: CashSession & Partial<Pick<SessionRecord, 'expenses'>>,
  live?: CashMethodDto[],
): CashSessionDto {
  const methods =
    live ?? (s.summary as unknown as CashMethodDto[] | null) ?? [];
  const openingCash = Number(s.openingCash);
  const expenses = s.expenses ?? [];
  const totals = expenseTotals(expenses);
  return {
    id: s.id,
    openingCash,
    openingNote: s.openingNote,
    openedAt: s.openedAt,
    openedByName: s.openedByName,
    closedAt: s.closedAt,
    closedByName: s.closedByName,
    closingNote: s.closingNote,
    expectedCash:
      s.expectedCash !== null
        ? Number(s.expectedCash)
        : expectedCash(openingCash, methods, totals.cash),
    countedCash: s.countedCash === null ? null : Number(s.countedCash),
    difference: s.difference === null ? null : Number(s.difference),
    methods,
    collected: round2(methods.reduce((sum, m) => sum + m.amount, 0)),
    expenses: expenses.map(toExpenseDto),
    expensesTotal: totals.total,
    cashExpensesTotal: totals.cash,
  };
}
