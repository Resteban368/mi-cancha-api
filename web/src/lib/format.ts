const ZONE = 'America/Bogota';

const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: ZONE });
const longDay = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONE });
const weekdayShort = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' });
const dayNumber = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

export const formatTime = (iso: string) => time.format(new Date(iso));

const hourOfDay = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: ZONE });

export type DayPeriod = 'day' | 'afternoon' | 'night';

/** Franja del turno en hora de Colombia: día 6–12, tarde 12–18, noche 18–6. */
export function dayPeriod(iso: string): DayPeriod {
  const hour = Number(hourOfDay.format(new Date(iso)));
  if (hour >= 6 && hour < 12) return 'day';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Jueves, 15 de octubre" de un instante, en hora de Colombia. */
export const formatLongDay = (iso: string) => capitalize(longDay.format(new Date(iso)));

/** Partes para el selector de fechas a partir de "2026-10-15". */
export function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: capitalize(weekdayShort.format(d).replace('.', '')),
    day: dayNumber.format(d),
    month: monthShort.format(d).replace('.', ''),
  };
}

export function formatMoney(value: number, currency = 'COP'): string {
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

/** Día (YYYY-MM-DD) en Colombia de un instante. */
export function bogotaDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date(iso));
}

/** Fecha de hoy (YYYY-MM-DD) en Colombia, desplazada `days` días. */
export function bogotaDate(days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

/** "Lunes" … "Domingo", en el orden de la semana. */
export const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
export const DAYS = Object.keys(DAY_LABELS);
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

/** "18:00" → "6:00 p. m.", con el formato de las horas de los turnos. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return time.format(new Date(Date.UTC(2026, 0, 1, h + 5, m)));
}

/** "6:00 a. m. a 11:00 p. m.", marcando cuando cierra al día siguiente. */
export function formatSpan(open: string, close: string): string {
  return `${formatClock(open)} a ${formatClock(close)}${close <= open ? ' (+1 día)' : ''}`;
}

/** "Lun a Vie", "Sáb, Dom" o "Todos los días" a partir de los días marcados. */
export function formatDays(days: string[]): string {
  if (days.length === 7) return 'Todos los días';
  const idx = days.map((d) => DAYS.indexOf(d)).sort((a, b) => a - b);
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (consecutive && idx.length > 2) return `${DAY_SHORT[DAYS[idx[0]]]} a ${DAY_SHORT[DAYS[idx.at(-1)!]]}`;
  return idx.map((i) => DAY_SHORT[DAYS[i]]).join(', ');
}

/** "2:41" para una cuenta regresiva en segundos. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const SPORT_LABELS: Record<string, string> = {
  FUTBOL: 'Fútbol',
  PADEL: 'Pádel',
  BALONCESTO: 'Baloncesto',
  VOLEIBOL: 'Voleibol',
};

export const SPORT_EMOJI: Record<string, string> = {
  FUTBOL: '⚽',
  PADEL: '🎾',
  BALONCESTO: '🏀',
  VOLEIBOL: '🏐',
};

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmada', className: 'bg-accent-soft text-accent' },
  COMPLETED: { label: 'Jugada', className: 'bg-surface-2 text-fg-2' },
  NO_SHOW: { label: 'No asististe', className: 'bg-warn-soft text-warn' },
  CANCELLED: { label: 'Cancelada', className: 'bg-danger-soft text-danger' },
};

const meters = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** "Grama sintética · 42 × 25 m · Fútbol 5"; vacío si la cancha no tiene esos datos. */
export function courtSpecs(court: {
  sport: string;
  surfaceName: string | null;
  lengthMeters: number | null;
  widthMeters: number | null;
  playersPerSide: number | null;
}): string {
  const size =
    court.lengthMeters !== null && court.widthMeters !== null
      ? `${meters.format(court.lengthMeters)} × ${meters.format(court.widthMeters)} m`
      : null;
  const n = court.playersPerSide;
  const format = n === null ? null : court.sport === 'FUTBOL' ? `Fútbol ${n}` : `${n} vs ${n}`;
  return [court.surfaceName, size, format].filter(Boolean).join(' · ');
}

const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});
const DAY_BY_INDEX = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Franja de tarifa (nocturna, fin de semana…) que aplica a un turno, o null si cobra el precio base. */
export function rateAt<R extends { days: string[]; startTime: string; endTime: string }>(
  rates: R[],
  startIso: string,
): R | null {
  const day = DAY_BY_INDEX[new Date(`${bogotaDateOf(startIso)}T12:00:00Z`).getUTCDay()];
  const at = clock.format(new Date(startIso));
  return (
    rates.find((r) => {
      if (!r.days.includes(day)) return false;
      const from = r.startTime.slice(0, 5);
      const to = r.endTime.slice(0, 5);
      // Una franja que termina "antes" de empezar cruza la medianoche.
      return to > from ? at >= from && at < to : at >= from || at < to;
    }) ?? null
  );
}
