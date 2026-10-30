/** Más canchas que esto ya no salen de la tabla: se acuerda un plan a medida. */
export const MAX_PRICED_COURTS = 20;

/** Precio mensual en COP según las canchas contratadas; la posición 0 es 1 cancha. */
const COURT_PRICES = [
  79_000, 98_000, 117_000, 136_000, 155_000, 171_000, 187_000, 203_000, 219_000,
  235_000, 248_000, 261_000, 274_000, 287_000, 300_000, 309_000, 318_000,
  327_000, 336_000, 345_000,
];

export function priceForCourts(courts: number): number {
  const price = COURT_PRICES[courts - 1];
  if (price === undefined) {
    throw new RangeError(`Sin precio para ${courts} canchas`);
  }
  return price;
}

/** La tabla completa, para mostrarla en el panel admin. */
export function courtPriceTable(): { courts: number; monthlyPrice: number }[] {
  return COURT_PRICES.map((monthlyPrice, i) => ({
    courts: i + 1,
    monthlyPrice,
  }));
}

interface PricedSubscription {
  courts: number | null;
  plan: { monthlyPrice: number; courtLimit: number; pricedByCourts: boolean };
}

/** Lo que paga y lo que puede usar el negocio: el plan por canchas manda sobre la fila del plan. */
export function subscriptionTerms(subscription: PricedSubscription): {
  monthlyPrice: number;
  courtLimit: number;
} {
  const { courts, plan } = subscription;
  if (plan.pricedByCourts && courts !== null) {
    return { monthlyPrice: priceForCourts(courts), courtLimit: courts };
  }
  return { monthlyPrice: plan.monthlyPrice, courtLimit: plan.courtLimit };
}
