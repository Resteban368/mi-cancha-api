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
const longDay = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
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

/** Monto en la moneda indicada (ISO 4217); los decimales solo si los tiene. */
export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}
export const formatNumber = (value: number) => number.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));
const shortDate = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Bogota',
});
/** "14/10/2026" en hora de Colombia. */
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));
/** "14 oct, 7:00 p. m." en hora de Colombia. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));
/** "lunes, 20 de octubre" en hora de Colombia. */
export const formatLongDay = (iso: string) => longDay.format(new Date(iso));

/** Fecha de hoy (YYYY-MM-DD) en hora de Colombia. */
export function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

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

export const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const DAY_SHORT: Record<string, string> = {
  MONDAY: 'L',
  TUESDAY: 'M',
  WEDNESDAY: 'X',
  THURSDAY: 'J',
  FRIDAY: 'V',
  SATURDAY: 'S',
  SUNDAY: 'D',
};

export const CUSTOMER_LEVELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'warn' }> = {
  VIP: { label: 'VIP Diamante', tone: 'warn' },
  FREQUENT: { label: 'Frecuente', tone: 'success' },
  RECURRENT: { label: 'Recurrente', tone: 'neutral' },
  NEW: { label: 'Nuevo', tone: 'neutral' },
};

/** "+573114567890" → "+57 311 456 7890" (otros formatos se dejan igual). */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

/** "1020334881" → "1.020.334.881" para cédulas solo numéricas. */
export function formatDocument(document: string): string {
  return /^[1-9]\d*$/.test(document) ? Number(document).toLocaleString('es-CO') : document;
}

export const PHOTO_SLOT_LABELS: Record<string, string> = {
  MAIN: 'Principal',
  SURFACE: 'Superficie',
  LIGHTING: 'Iluminación',
  EXTRA_1: 'Extra 1',
  EXTRA_2: 'Extra 2',
};

/** "18:00"–"02:00" → "18:00 – 02:00 (+1)" cuando termina al día siguiente. */
export function formatSpan(start: string, end: string): string {
  return `${start} – ${end}${end <= start ? ' (+1 día)' : ''}`;
}

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
  REFUNDED: { label: 'Devuelto', tone: 'neutral' },
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
