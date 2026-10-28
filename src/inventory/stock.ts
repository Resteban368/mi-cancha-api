import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';

type Tx = Prisma.TransactionClient;

export interface StockActor {
  id: string | null;
  name: string | null;
}

/**
 * Descuenta del stock las unidades vendidas de los productos que llevan
 * control de existencias y deja el movimiento VENTA ligado a la venta.
 * Lanza 409 si alguno no alcanza (no se vende más de lo que hay).
 */
export async function takeStockForSale(
  tx: Tx,
  input: {
    businessId: string;
    saleId: string;
    lines: { productId: string; productName: string; quantity: number }[];
    actor: StockActor;
  },
): Promise<void> {
  const tracked = await tx.product.findMany({
    where: {
      businessId: input.businessId,
      id: { in: input.lines.map((l) => l.productId) },
      trackStock: true,
    },
    select: { id: true },
  });
  const ids = new Set(tracked.map((p) => p.id));
  for (const line of input.lines) {
    if (!ids.has(line.productId)) continue;
    // El stock en el filtro evita vender de más con dos ventas a la vez.
    const { count } = await tx.product.updateMany({
      where: { id: line.productId, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    const product = await tx.product.findUniqueOrThrow({
      where: { id: line.productId },
      select: { stock: true },
    });
    if (count === 0) {
      throw new ConflictException(
        `No hay suficiente stock de ${line.productName}: quedan ${product.stock}`,
      );
    }
    await tx.stockMovement.create({
      data: {
        businessId: input.businessId,
        productId: line.productId,
        type: StockMovementType.VENTA,
        quantity: -line.quantity,
        stockAfter: product.stock,
        saleId: input.saleId,
        createdById: input.actor.id,
        createdByName: input.actor.name,
      },
    });
  }
}

/**
 * Devuelve al stock lo que descontaron esas ventas (sus movimientos VENTA)
 * con un movimiento ANULACION. Las ventas sin control de stock no cambian.
 */
export async function restoreStockForSales(
  tx: Tx,
  input: { businessId: string; saleIds: string[]; actor: StockActor },
): Promise<void> {
  if (!input.saleIds.length) return;
  const taken = await tx.stockMovement.findMany({
    where: {
      businessId: input.businessId,
      saleId: { in: input.saleIds },
      type: StockMovementType.VENTA,
    },
    select: { productId: true, quantity: true, saleId: true },
  });
  for (const movement of taken) {
    const units = -movement.quantity;
    const product = await tx.product.update({
      where: { id: movement.productId },
      data: { stock: { increment: units } },
      select: { stock: true },
    });
    await tx.stockMovement.create({
      data: {
        businessId: input.businessId,
        productId: movement.productId,
        type: StockMovementType.ANULACION,
        quantity: units,
        stockAfter: product.stock,
        saleId: movement.saleId,
        createdById: input.actor.id,
        createdByName: input.actor.name,
      },
    });
  }
}
