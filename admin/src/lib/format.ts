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
const dateTime = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
const time = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
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
/** "14 oct, 7:00 p. m." en hora de Colombia. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));

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

export const SPORT_LABELS: Record<string, string> = {
  FUTBOL: 'Fútbol',
  PADEL: 'Pádel',
  BALONCESTO: 'Baloncesto',
  VOLEIBOL: 'Voleibol',
};

export const RESERVATION_STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'warn' }> = {
  CONFIRMED: { label: 'Confirmada', tone: 'success' },
  COMPLETED: { label: 'Jugada', tone: 'neutral' },
  NO_SHOW: { label: 'No asistió', tone: 'warn' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'warn' }> = {
  PENDING: { label: 'Pendiente', tone: 'warn' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
};

export const PAYMENT_CONCEPT_LABELS: Record<string, string> = {
  ANTICIPO: 'Anticipo',
  SALDO: 'Saldo',
  TOTAL: 'Total',
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
