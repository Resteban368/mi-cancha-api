// Los precios vigentes se editan en el admin y salen de la API (ver usePrecios). Esta tabla es solo
// el respaldo por si la API no responde durante el build.
const PRECIOS_RESPALDO = [
  79_000, 98_000, 117_000, 136_000, 155_000, 171_000, 187_000, 203_000, 219_000, 235_000, 248_000, 261_000, 274_000,
  287_000, 300_000, 309_000, 318_000, 327_000, 336_000, 345_000,
];

declare global {
  // Lo define scripts/prerender.mjs con los precios leídos de la API en el build.
  var __PRECIOS__: number[] | undefined;
  var __PRECIO_VENTAS__: number | undefined;
}

export const MAX_CANCHAS = PRECIOS_RESPALDO.length;

/** Los mismos en el prerender y en la hidratación, para que React no vea diferencias. */
export const preciosIniciales = () => globalThis.__PRECIOS__ ?? PRECIOS_RESPALDO;

/** Módulo Ventas e inventario; 0 = sin precio publicado («Consultar precio»). */
export const precioVentasInicial = () => globalThis.__PRECIO_VENTAS__ ?? 0;

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** $ 117.000 */
export const formatoPesos = (valor: number) => `$ ${pesos.format(Math.round(valor))}`;

/** $117.000, para usar dentro de una frase. */
export const pesosEnTexto = (valor: number) => `$${pesos.format(Math.round(valor))}`;
