// Copia de la tabla de la API (src/common/plan-pricing.ts); un test comprueba que coincidan.

/** Precio mensual en COP según las canchas; la posición 0 es 1 cancha. */
export const PRECIOS = [
  79_000, 98_000, 117_000, 136_000, 155_000, 171_000, 187_000, 203_000, 219_000, 235_000, 248_000, 261_000, 274_000,
  287_000, 300_000, 309_000, 318_000, 327_000, 336_000, 345_000,
];

export const MAX_CANCHAS = PRECIOS.length;

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** $ 117.000 */
export const formatoPesos = (valor: number) => `$ ${pesos.format(Math.round(valor))}`;
