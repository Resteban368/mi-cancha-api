import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service.js';
import { Page, pageArgs } from '../common/dto/page.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isLowStock } from '../sales/sales.service.js';
import {
  InventoryDto,
  StockAdjustmentDto,
  StockEntryDto,
  StockMovementDto,
  StockMovementsQueryDto,
} from './dto/inventory.dto.js';

const movementInclude = {
  product: { select: { name: true } },
  supplier: { select: { name: true } },
} satisfies Prisma.StockMovementInclude;

type MovementRecord = Prisma.StockMovementGetPayload<{
  include: typeof movementInclude;
}>;

/**
 * Inventario de productos: existencias, entradas de mercancía, ajustes por
 * conteo físico e historial. Las ventas descuentan y las anulaciones
 * devuelven (ver stock.ts).
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async overview(ownerId: string): Promise<InventoryDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      trackStock: p.trackStock,
      stock: p.stock,
      minStock: p.minStock,
      lowStock: isLowStock(p),
    }));
    const tracked = items.filter((i) => i.trackStock);
    return {
      items,
      tracked: tracked.length,
      low: tracked.filter((i) => i.lowStock && i.stock > 0).length,
      out: tracked.filter((i) => i.stock <= 0).length,
    };
  }

  /** Entrada de mercancía: suma al stock (y activa su control si no lo tenía). */
  async addEntry(
    ownerId: string,
    dto: StockEntryDto,
  ): Promise<StockMovementDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const [product, supplier, actorName] = await Promise.all([
      this.requireProduct(businessId, dto.productId),
      dto.supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: dto.supplierId, businessId },
            select: { id: true },
          })
        : null,
      this.userName(ownerId),
    ]);
    if (dto.supplierId && !supplier) {
      throw new NotFoundException('El proveedor no existe');
    }
    const movement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: dto.quantity }, trackStock: true },
        select: { stock: true },
      });
      return tx.stockMovement.create({
        data: {
          businessId,
          productId: product.id,
          type: StockMovementType.ENTRADA,
          quantity: dto.quantity,
          stockAfter: updated.stock,
          unitCost: dto.unitCost,
          supplierId: supplier?.id,
          note: dto.note || null,
          createdById: ownerId,
          createdByName: actorName,
        },
        include: movementInclude,
      });
    });
    return toMovementDto(movement);
  }

  /** Ajuste por conteo físico: deja el stock en el valor contado. */
  async adjust(
    ownerId: string,
    dto: StockAdjustmentDto,
  ): Promise<StockMovementDto> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const [, actorName] = await Promise.all([
      this.requireProduct(businessId, dto.productId),
      this.userName(ownerId),
    ]);
    const movement = await this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findUniqueOrThrow({
        where: { id: dto.productId },
        select: { stock: true },
      });
      const delta = dto.stock - current.stock;
      if (delta === 0) {
        throw new ConflictException('El stock ya está en ese valor');
      }
      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: dto.stock, trackStock: true },
      });
      return tx.stockMovement.create({
        data: {
          businessId,
          productId: dto.productId,
          type: StockMovementType.AJUSTE,
          quantity: delta,
          stockAfter: dto.stock,
          note: dto.reason,
          createdById: ownerId,
          createdByName: actorName,
        },
        include: movementInclude,
      });
    });
    return toMovementDto(movement);
  }

  async movements(
    ownerId: string,
    query: StockMovementsQueryDto,
  ): Promise<Page<StockMovementDto>> {
    const businessId = await this.businesses.requireSalesModule(ownerId);
    const where = { businessId, productId: query.productId };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return {
      items: items.map(toMovementDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async requireProduct(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('El producto no existe');
    return product;
  }

  private async userName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }
}

function toMovementDto(m: MovementRecord): StockMovementDto {
  return {
    id: m.id,
    productId: m.productId,
    productName: m.product.name,
    type: m.type,
    quantity: m.quantity,
    stockAfter: m.stockAfter,
    unitCost: m.unitCost === null ? null : Number(m.unitCost),
    supplierName: m.supplier?.name ?? null,
    note: m.note,
    createdByName: m.createdByName,
    createdAt: m.createdAt,
  };
}
