import type { PrismaService } from '../prisma/prisma.service.js';

/** Más canchas que esto ya no salen de la tabla: se acuerda un plan a medida. */
export const MAX_PRICED_COURTS = 20;

/** Precio mensual según las canchas contratadas; la posición 0 de la tabla es 1 cancha. */
export function priceForCourts(courtPrices: number[], courts: number): number {
  const price = courtPrices[courts - 1];
  if (price === undefined) {
    throw new RangeError(`Sin precio para ${courts} canchas`);
  }
  return price;
}

/** La tabla completa, para mostrarla en el panel admin y en la landing. */
export function courtPriceTable(
  courtPrices: number[],
): { courts: number; monthlyPrice: number }[] {
  return courtPrices.map((monthlyPrice, i) => ({
    courts: i + 1,
    monthlyPrice,
  }));
}

interface PricedSubscription {
  courts: number | null;
  plan: {
    monthlyPrice: number;
    courtLimit: number;
    pricedByCourts: boolean;
    courtPrices: number[];
  };
}

/** Lo que paga y lo que puede usar el negocio: el plan por canchas manda sobre la fila del plan. */
export function subscriptionTerms(subscription: PricedSubscription): {
  monthlyPrice: number;
  courtLimit: number;
} {
  const { courts, plan } = subscription;
  if (plan.pricedByCourts && courts !== null) {
    return {
      monthlyPrice: priceForCourts(plan.courtPrices, courts),
      courtLimit: courts,
    };
  }
  return { monthlyPrice: plan.monthlyPrice, courtLimit: plan.courtLimit };
}

/** Precio de lista vigente del módulo Ventas e inventario. */
export async function salesModuleListPrice(
  prisma: Pick<PrismaService, 'billingSettings'>,
): Promise<number> {
  const settings = await prisma.billingSettings.findUnique({
    where: { id: 1 },
    select: { salesModulePrice: true },
  });
  return settings?.salesModulePrice ?? 0;
}

/** Lo que paga el negocio al mes. El módulo solo se cobra sobre un plan de pago, nunca en prueba. */
export function monthlyBill(
  planPrice: number,
  salesModuleEnabled: boolean,
  salesModuleListPrice: number,
): { salesModulePrice: number; totalMonthlyPrice: number } {
  const salesModulePrice =
    salesModuleEnabled && planPrice > 0 ? salesModuleListPrice : 0;
  return { salesModulePrice, totalMonthlyPrice: planPrice + salesModulePrice };
}
