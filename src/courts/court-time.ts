// Cálculos de horario y tarifas de una cancha sobre una semana de minutos.
// El minuto 0 es el lunes a las 00:00 (hora local del negocio); la semana tiene
// 10.080 minutos y las franjas que pasan del domingo siguen en el lunes.
import { DayOfWeek } from '../generated/prisma/enums.js';

export const DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábado',
  SUNDAY: 'domingo',
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_MINUTES = 24 * 60;
const WEEK_MINUTES = 7 * DAY_MINUTES;

/** Intervalo semiabierto [start, end) en minutos de la semana, sin cruzar el fin de semana. */
export interface Interval {
  start: number;
  end: number;
}

export interface ScheduleInput {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export interface RateInput {
  name: string;
  pricePerHour: number;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Duración de una franja HH:mm–HH:mm; si el fin es menor, termina al día siguiente. Iguales = 24 h. */
function spanMinutes(start: string, end: string): number {
  return (
    (toMinutes(end) - toMinutes(start) + DAY_MINUTES) % DAY_MINUTES ||
    DAY_MINUTES
  );
}

/** Franja que empieza el día `day` a la hora `start`, partida si cruza el fin de la semana. */
function weekIntervals(day: DayOfWeek, start: string, end: string): Interval[] {
  const from = DAYS.indexOf(day) * DAY_MINUTES + toMinutes(start);
  return wrap(from, from + spanMinutes(start, end));
}

function wrap(start: number, end: number): Interval[] {
  const s = ((start % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;
  const e = s + (end - start);
  return e <= WEEK_MINUTES
    ? [{ start: s, end: e }]
    : [
        { start: s, end: WEEK_MINUTES },
        { start: 0, end: e - WEEK_MINUTES },
      ];
}

function overlap(a: Interval[], b: Interval[]): number {
  let total = 0;
  for (const x of a) {
    for (const y of b) {
      total += Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
    }
  }
  return total;
}

/** Une intervalos que se tocan o se cruzan (p. ej. lunes 18–24 y martes 0–02). */
function merge(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const i of sorted) {
    const last = merged.at(-1);
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else merged.push({ ...i });
  }
  return merged;
}

/** Errores de los 7 horarios: días faltantes o repetidos, horas ausentes. */
export function scheduleErrors(schedules: ScheduleInput[]): string[] {
  const errors: string[] = [];
  const days = schedules.map((s) => s.dayOfWeek);
  const missing = DAYS.filter((d) => !days.includes(d));
  const repeated = DAYS.filter((d) => days.filter((x) => x === d).length > 1);
  if (missing.length) {
    errors.push(
      `Falta el horario de: ${missing.map((d) => DAY_LABELS[d]).join(', ')}`,
    );
  }
  if (repeated.length) {
    errors.push(
      `Horario repetido para: ${repeated.map((d) => DAY_LABELS[d]).join(', ')}`,
    );
  }
  for (const s of schedules) {
    if (s.isOpen && (!s.openTime || !s.closeTime)) {
      errors.push(
        `El ${DAY_LABELS[s.dayOfWeek]} está abierto: indica openTime y closeTime`,
      );
    }
  }
  return errors;
}

/** Errores de las tarifas: dos franjas que se cruzan en algún momento de la semana. */
export function rateErrors(rates: RateInput[]): string[] {
  const errors: string[] = [];
  const expanded = rates.map((r) =>
    r.days.flatMap((d) => weekIntervals(d, r.startTime, r.endTime)),
  );
  for (let i = 0; i < rates.length; i++) {
    for (let j = i + 1; j < rates.length; j++) {
      if (overlap(expanded[i], expanded[j]) > 0) {
        errors.push(
          `Las tarifas "${rates[i].name}" y "${rates[j].name}" se cruzan`,
        );
      }
    }
  }
  return errors;
}

/** Minutos de la semana (hora local) del instante `date`, con `utcOffset` tipo -05:00. */
export function minuteOfWeek(date: Date, utcOffset: string): number {
  const sign = utcOffset.startsWith('-') ? -1 : 1;
  const offset = sign * toMinutes(utcOffset.slice(1));
  const local = new Date(date.getTime() + offset * 60_000);
  const day = (local.getUTCDay() + 6) % 7; // lunes = 0
  return day * DAY_MINUTES + local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Intervalos de la reserva en la semana local. */
export function reservationIntervals(
  start: Date,
  end: Date,
  utcOffset: string,
): Interval[] {
  const from = minuteOfWeek(start, utcOffset);
  return wrap(
    from,
    from + Math.round((end.getTime() - start.getTime()) / 60_000),
  );
}

/** true si la reserva cae completa dentro de los horarios abiertos. */
export function fitsSchedule(
  reservation: Interval[],
  schedules: ScheduleInput[],
): boolean {
  const open = merge(
    schedules
      .filter((s) => s.isOpen && s.openTime && s.closeTime)
      .flatMap((s) => weekIntervals(s.dayOfWeek, s.openTime!, s.closeTime!)),
  );
  const length = reservation.reduce((sum, i) => sum + (i.end - i.start), 0);
  return overlap(reservation, open) === length;
}

/** Precio de la reserva: cada fracción con su tarifa y el resto con el precio base. */
export function priceFor(
  reservation: Interval[],
  basePricePerHour: number,
  rates: RateInput[],
): number {
  const length = reservation.reduce((sum, i) => sum + (i.end - i.start), 0);
  let covered = 0;
  let total = 0;
  for (const rate of rates) {
    const minutes = overlap(
      reservation,
      rate.days.flatMap((d) => weekIntervals(d, rate.startTime, rate.endTime)),
    );
    covered += minutes;
    total += (minutes / 60) * rate.pricePerHour;
  }
  total += ((length - covered) / 60) * basePricePerHour;
  return Math.round(total * 100) / 100;
}
