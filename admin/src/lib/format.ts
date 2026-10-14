const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('es-CO');
const date = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatCop = (value: number) => cop.format(value);
export const formatNumber = (value: number) => number.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));

/** "2026-10" → "oct" */
export const formatMonthShort = (month: string) =>
  monthShort.format(new Date(`${month}-01T00:00:00Z`)).replace('.', '');

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "2026-10" → "Octubre de 2026" */
export const formatMonthLong = (month: string) =>
  capitalize(monthLong.format(new Date(`${month}-01T00:00:00Z`)));

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN_NEGOCIO: 'Negocio',
  JUGADOR: 'Jugador',
};

export const PROVIDER_LABELS: Record<string, string> = {
  password: 'Contraseña',
  google: 'Google',
  apple: 'Apple',
};

/** "Iluminación LED" → "ILUMINACION_LED" (sugerencia de código para catálogos). */
export function toCatalogCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
