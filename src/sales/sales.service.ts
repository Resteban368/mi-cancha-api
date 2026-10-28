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

export const saleInclude = {
  items: { orderBy: { productName: 'asc' } },
  payment: { select: { method: { select: { code: true } } } },
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
    const businessId = await this.businesses.requireBusinessId(ownerId);
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
    const businessId = await this.businesses.requireBusinessId(ownerId);
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
      },
    });
    return toProductDto(product);
  }

  async updateProduct(
    ownerId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
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
    const businessId = await this.businesses.requireBusinessId(ownerId);
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
   * paga en el momento con un pago aprobado de concepto VENTA.
   */
  async createSale(
    ownerId: string,
    dto: CreateSaleDto,
    actorId: string,
  ): Promise<SaleDto> {
    const businessId = await this.businesses.requireBusinessId(ownerId);
    if (dto.reservationId && dto.payment) {
      throw new BadRequestException(
        'Un consumo de reserva se paga con la reserva: no envíes payment',
      );
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

      if (method && total > 0) {
        const reference = dto.payment?.reference?.trim() || null;
        await tx.payment.create({
          data: {
            businessId,
            saleId: created.id,
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
    const businessId = await this.businesses.requireBusinessId(ownerId);
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
  };
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
  };
}
