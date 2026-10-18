const ZONE = 'America/Bogota';

const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: ZONE });
const longDay = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONE });
const weekdayShort = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' });
const dayNumber = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

export const formatTime = (iso: string) => time.format(new Date(iso));

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

/** Fecha de hoy (YYYY-MM-DD) en Colombia, desplazada `days` días. */
export function bogotaDate(days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(
    new Date(Date.now() + days * 86_400_000),
  );
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
