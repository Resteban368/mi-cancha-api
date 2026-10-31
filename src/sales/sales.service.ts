import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { dayRange } from '../common/utils/day-range.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  PaymentConcept,
  PaymentStatus,
  type ProductCategory,
  ReservationStatus,
  SaleStatus,
} from '../generated/prisma/enums.js';
import { restoreStockForSales, takeStockForSale } from '../inventory/stock.js';
import { syncCouponStamps } from '../coupons/coupon-stamps.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateProductDto,
  CreateSaleDto,
  MAX_PRODUCTS,
  MAX_QUANTITY,
  POPULAR_DAYS,
  ProductDto,
  ProductsQueryDto,
  SaleDto,
  SalesQueryDto,
  UpdateProductDto,
  VoidSaleDto,
} from './dto/sale.dto.js';

/** Ventas de un día o de una reserva: tope de seguridad. */
const SALES_LIMIT = 500;
const WALK_IN_CUSTOMER = 'Venta de mostrador';

/** Reservas a las que se les pueden cargar consumos. */
const OPEN_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
];

/**
 * Lo que hace falta de una reserva para repartir lo pagado: la cancha, los
 * consumos cargados al saldo (sin pago propio) y los pagos que no son de un
 * consumo cobrado en el momento.
 */
const balanceSelect = {
  totalPrice: true,
  sales: {
    where: { status: SaleStatus.ACTIVE, payment: { is: null } },
    select: { id: true, total: true, createdAt: true },
  },
  payments: {
    where: { status: PaymentStatus.APPROVED, saleId: null },
    select: { amount: true },
  },
} satisfies Prisma.ReservationSelect;

export const saleInclude = {
  items: { orderBy: { productName: 'asc' } },
  payment: { select: { method: { select: { code: true } } } },
  reservation: {
    select: {
      start: true,
      court: { select: { name: true } },
      ...balanceSelect,
      // Varias canchas reservadas juntas se pagan como una sola.
      group: { select: { reservations: { select: balanceSelect } } },
    },
  },
} satisfies Prisma.SaleInclude;

export type SaleWithItems = Prisma.SaleGetPayload<{
  include: typeof saleInclude;
}>;

@Injectable()
export class SalesService {
  private readonly utcOffset: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly catalogs: CatalogsService,
    config: ConfigService,
  ) {
    this.utcOffset = config.getOrThrow<string>('APP_UTC_OFFSET');
  }

  // ---------- Productos ----------

  async listProducts(
    ownerId: string,
    query: ProductsQueryDto,
  ): Promise<ProductDto[]> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
      take: MAX_PRODUCTS,
    });
    const sold = await this.soldUnits(products.map((p) => p.id));
    const dtos = products.map((p) => toProductDto(p, sold.get(p.id)));
    // sort es estable: a igual venta queda el orden por nombre.
    if (query.sort === 'popular') dtos.sort((a, b) => b.sold - a.sold);
    return dtos;
  }

  /** Unidades vendidas por producto en los últimos POPULAR_DAYS días. */
  private async soldUnits(productIds: string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();
    const since = new Date(Date.now() - POPULAR_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        sale: { status: SaleStatus.ACTIVE, createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    });
    return new Map(
      rows.map((r) => [r.productId!, r._sum.quantity ?? 0] as const),
    );
  }

  async createProduct(
    ownerId: string,
    dto: CreateProductDto,
  ): Promise<ProductDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const count = await this.prisma.product.count({ where: { businessId } });
    if (count >= MAX_PRODUCTS) {
      throw new ConflictException(
        `Llegaste al máximo de ${MAX_PRODUCTS} productos: desactiva o renombra uno`,
      );
    }
    await this.assertNameFree(businessId, dto.name);
    const product = await this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        category: dto.category,
        price: dto.price,
        trackStock: dto.trackStock,
        minStock: dto.minStock,
      },
    });
    return toProductDto(product);
  }

  async updateProduct(
    ownerId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const current = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('El producto no existe');
    if (dto.name !== undefined)
      await this.assertNameFree(businessId, dto.name, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        price: dto.price,
        isActive: dto.isActive,
        trackStock: dto.trackStock,
        minStock: dto.minStock,
      },
    });
    const sold = await this.soldUnits([id]);
    return toProductDto(product, sold.get(id));
  }

  private async assertNameFree(
    businessId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const taken = await this.prisma.product.findFirst({
      where: {
        businessId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(`Ya tienes un producto llamado "${name}"`);
    }
  }

  // ---------- Ventas ----------

  async listSales(ownerId: string, query: SalesQueryDto): Promise<SaleDto[]> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const range = query.date ? dayRange(query.date, this.utcOffset) : null;
    const sales = await this.prisma.sale.findMany({
      where: {
        businessId,
        reservationId: query.reservationId,
        ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}),
      },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
      take: SALES_LIMIT,
    });
    return sales.map(toSaleDto);
  }

  /**
   * Consumo cargado a una reserva (suma a su saldo) o venta suelta, que se
   * paga en el momento con un pago aprobado de concepto VENTA. Un consumo
   * con payment se cobra ya: el pago queda en la reserva y su saldo no cambia.
   */
  async createSale(
    ownerId: string,
    dto: CreateSaleDto,
    actorId: string,
  ): Promise<SaleDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    // Sin caja abierta no se vende: todo lo vendido cae en un turno.
    const openCash = await this.prisma.cashSession.count({
      where: { businessId, closedAt: null },
    });
    if (openCash === 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'CASH_CLOSED',
        message:
          'La caja está cerrada. Ábrela con la base de efectivo para registrar ventas.',
      });
    }
    if (!dto.reservationId && !dto.payment) {
      throw new BadRequestException(
        'Una venta suelta necesita el método de pago',
      );
    }

    // El mismo producto dos veces se junta en una línea.
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }
    if ([...quantities.values()].some((q) => q > MAX_QUANTITY)) {
      throw new BadRequestException(
        `La cantidad de un producto no puede superar ${MAX_QUANTITY}`,
      );
    }

    const products = await this.prisma.product.findMany({
      where: { businessId, id: { in: [...quantities.keys()] }, isActive: true },
    });
    if (products.length !== quantities.size) {
      throw new BadRequestException(
        'Algún producto no existe o está desactivado',
      );
    }
    const items = products.map((p) => {
      const quantity = quantities.get(p.id)!;
      const unitPrice = Number(p.price);
      return {
        productId: p.id,
        productName: p.name,
        unitPrice,
        quantity,
        subtotal: round2(unitPrice * quantity),
      };
    });
    const total = round2(items.reduce((sum, i) => sum + i.subtotal, 0));

    const method = dto.payment
      ? await this.catalogs.resolvePaymentMethod(dto.payment.method)
      : null;
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { displayName: true },
    });

    const sale = await this.prisma.$transaction(async (tx) => {
      let customerName = dto.customerName || null;
      if (dto.reservationId) {
        const reservation = await tx.reservation.findFirst({
          where: { id: dto.reservationId, businessId },
          select: { id: true, status: true, customerName: true },
        });
        if (!reservation) throw new NotFoundException('La reserva no existe');
        if (!OPEN_STATUSES.includes(reservation.status)) {
          throw new ConflictException(
            'Solo se pueden cargar consumos a reservas confirmadas o jugadas',
          );
        }
        customerName = reservation.customerName;
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { consumptionsTotal: { increment: total } },
        });
      }

      const created = await tx.sale.create({
        data: {
          businessId,
          reservationId: dto.reservationId,
          customerName,
          total,
          note: dto.note || null,
          createdById: actorId,
          items: { create: items },
        },
      });

      // Descuenta el stock de los productos que lo controlan (y no deja
      // vender de más).
      await takeStockForSale(tx, {
        businessId,
        saleId: created.id,
        lines: items,
        actor: { id: actorId, name: actor?.displayName ?? null },
      });

      if (method && total > 0) {
        const reference = dto.payment?.reference?.trim() || null;
        await tx.payment.create({
          data: {
            businessId,
            saleId: created.id,
            reservationId: dto.reservationId,
            customerName: customerName ?? WALK_IN_CUSTOMER,
            amount: total,
            methodId: method.id,
            concept: PaymentConcept.VENTA,
            reference: method.requiresReference ? reference : null,
            status: PaymentStatus.APPROVED,
            registeredByBusiness: true,
          },
        });
      }

      if (dto.reservationId) {
        await syncCouponStamps(tx, businessId, dto.reservationId);
      }

      return tx.sale.findUniqueOrThrow({
        where: { id: created.id },
        include: saleInclude,
      });
    });
    return toSaleDto(sale);
  }

  /**
   * Anula una venta: deja de sumar al saldo de su reserva y, si era suelta,
   * su pago queda devuelto. No se borra, para que el negocio la vea.
   */
  async voidSale(
    ownerId: string,
    id: string,
    dto: VoidSaleDto,
  ): Promise<SaleDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const sale = await this.prisma.$transaction(async (tx) => {
      // updateMany con el estado en el filtro evita anular dos veces en paralelo.
      const { count } = await tx.sale.updateMany({
        where: { id, businessId, status: SaleStatus.ACTIVE },
        data: {
          status: SaleStatus.VOIDED,
          voidReason: dto.reason,
          voidedAt: new Date(),
        },
      });
      const current = await tx.sale.findFirst({
        where: { id, businessId },
        include: saleInclude,
      });
      if (!current) throw new NotFoundException('La venta no existe');
      if (count === 0) throw new ConflictException('La venta ya fue anulada');

      if (current.reservationId) {
        await tx.reservation.update({
          where: { id: current.reservationId },
          data: { consumptionsTotal: { decrement: current.total } },
        });
      }
      await tx.payment.updateMany({
        where: { saleId: current.id, status: PaymentStatus.APPROVED },
        data: { status: PaymentStatus.REFUNDED },
      });
      // Lo vendido vuelve al stock.
      await restoreStockForSales(tx, {
        businessId,
        saleIds: [current.id],
        actor: { id: ownerId, name: null },
      });
      if (current.reservationId) {
        await syncCouponStamps(tx, businessId, current.reservationId);
      }
      return current;
    });
    return toSaleDto(sale);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toProductDto(
  p: {
    id: string;
    name: string;
    category: ProductCategory;
    price: Prisma.Decimal | number;
    isActive: boolean;
    trackStock: boolean;
    stock: number;
    minStock: number | null;
  },
  sold = 0,
): ProductDto {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    isActive: p.isActive,
    sold,
    trackStock: p.trackStock,
    stock: p.stock,
    minStock: p.minStock,
    lowStock: isLowStock(p),
  };
}

/** Sin unidades, o en el mínimo o por debajo. */
export function isLowStock(p: {
  trackStock: boolean;
  stock: number;
  minStock: number | null;
}): boolean {
  if (!p.trackStock) return false;
  return p.stock <= 0 || (p.minStock !== null && p.stock <= p.minStock);
}

export function toSaleDto(s: SaleWithItems): SaleDto {
  return {
    id: s.id,
    reservationId: s.reservationId,
    customerName: s.customerName,
    total: Number(s.total),
    note: s.note,
    status: s.status,
    voidReason: s.voidReason,
    voidedAt: s.voidedAt,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      subtotal: Number(i.subtotal),
    })),
    paymentMethod: s.payment?.method.code ?? null,
    courtName: s.reservation?.court.name ?? null,
    reservationStart: s.reservation?.start ?? null,
    ...reservationCharge(s),
  };
}

type BalanceParts = {
  totalPrice: Prisma.Decimal | number;
  sales: {
    id: string;
    total: Prisma.Decimal | number;
    createdAt: Date;
  }[];
  payments: { amount: Prisma.Decimal | number }[];
};

/**
 * Cuánto falta por cobrar de un consumo cargado al saldo. Lo pagado en la
 * reserva (o en su grupo de canchas) cubre primero la cancha y luego los
 * consumos en el orden en que se cargaron.
 */
function reservationCharge(s: SaleWithItems): {
  reservationPending: number;
  reservationPaid: boolean;
} {
  const total = Number(s.total);
  const reservation = s.reservation;
  // Venta suelta o consumo cobrado en el momento: no depende de la reserva.
  if (!reservation || s.payment) {
    return { reservationPending: 0, reservationPaid: false };
  }
  const members = reservation.group?.reservations ?? [reservation];
  let available = members.reduce(
    (sum, m) =>
      sum +
      m.payments.reduce((paid, p) => paid + Number(p.amount), 0) -
      Number(m.totalPrice),
    0,
  );
  const charged = members
    .flatMap((m) => m.sales)
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  for (const sale of charged) {
    const amount = Number(sale.total);
    const covered = Math.min(amount, Math.max(available, 0));
    available -= amount;
    if (sale.id === s.id) {
      const pending = round2(amount - covered);
      return { reservationPending: pending, reservationPaid: pending <= 0 };
    }
  }
  // Anulada o fuera de la lista: no se cobra.
  return {
    reservationPending: s.status === SaleStatus.ACTIVE ? total : 0,
    reservationPaid: false,
  };
}
