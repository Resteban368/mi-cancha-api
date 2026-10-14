/**
 * Devuelve el rango [from, to) en UTC que corresponde a un día calendario
 * (YYYY-MM-DD) en la zona horaria del negocio.
 */
export function dayRange(date: string, utcOffset: string) {
  const from = new Date(`${date}T00:00:00.000${utcOffset}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}
