/** Máximo "redondo" y ticks para un eje que empieza en 0 (≈4 divisiones). */
export function niceScale(max: number, divisions = 4) {
  if (max <= 0) return { max: divisions, ticks: [0, 1, 2, 3, 4] };
  const rough = max / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(niceMax / step) + 1 }, (_, i) => i * step);
  return { max: niceMax, ticks };
}
