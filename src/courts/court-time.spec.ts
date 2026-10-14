import { DayOfWeek } from '../generated/prisma/enums.js';
import {
  DAYS,
  daySlots,
  fitsSchedule,
  priceFor,
  rateErrors,
  reservationIntervals,
  scheduleErrors,
  type ScheduleInput,
} from './court-time.js';

const OFFSET = '-05:00';
const WEEKDAYS = DAYS.slice(0, 5);

function week(openTime: string, closeTime: string): ScheduleInput[] {
  return DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openTime,
    closeTime,
  }));
}

/** 2026-10-12 es lunes. */
function slot(start: string, end: string) {
  return reservationIntervals(
    new Date(`${start}-05:00`),
    new Date(`${end}-05:00`),
    OFFSET,
  );
}

describe('court-time', () => {
  describe('scheduleErrors', () => {
    it('acepta los 7 días', () => {
      expect(scheduleErrors(week('06:00', '23:00'))).toEqual([]);
    });

    it('reporta días faltantes, repetidos y horas ausentes', () => {
      const schedules = week('06:00', '23:00').slice(0, 6);
      schedules.push({ dayOfWeek: DayOfWeek.MONDAY, isOpen: true });
      expect(scheduleErrors(schedules)).toEqual([
        'Falta el horario de: domingo',
        'Horario repetido para: lunes',
        'El lunes está abierto: indica openTime y closeTime',
      ]);
    });
  });

  describe('rateErrors', () => {
    it('acepta franjas contiguas', () => {
      expect(
        rateErrors([
          {
            name: 'Diurna',
            pricePerHour: 60_000,
            days: WEEKDAYS,
            startTime: '06:00',
            endTime: '18:00',
          },
          {
            name: 'Nocturna',
            pricePerHour: 90_000,
            days: WEEKDAYS,
            startTime: '18:00',
            endTime: '23:00',
          },
        ]),
      ).toEqual([]);
    });

    it('detecta cruces, también los que pasan de medianoche', () => {
      expect(
        rateErrors([
          {
            name: 'Trasnocho',
            pricePerHour: 70_000,
            days: [DayOfWeek.FRIDAY],
            startTime: '22:00',
            endTime: '02:00',
          },
          {
            name: 'Sábado',
            pricePerHour: 90_000,
            days: [DayOfWeek.SATURDAY],
            startTime: '00:00',
            endTime: '12:00',
          },
        ]),
      ).toEqual(['Las tarifas "Trasnocho" y "Sábado" se cruzan']);
    });

    it('detecta el cruce del domingo al lunes', () => {
      expect(
        rateErrors([
          {
            name: 'Domingo noche',
            pricePerHour: 1,
            days: [DayOfWeek.SUNDAY],
            startTime: '23:00',
            endTime: '01:00',
          },
          {
            name: 'Lunes',
            pricePerHour: 1,
            days: [DayOfWeek.MONDAY],
            startTime: '00:30',
            endTime: '06:00',
          },
        ]),
      ).toHaveLength(1);
    });
  });

  describe('fitsSchedule', () => {
    it('acepta reservas dentro del horario y rechaza las que se salen', () => {
      const schedules = week('06:00', '23:00');
      expect(
        fitsSchedule(
          slot('2026-10-12T19:00:00', '2026-10-12T20:00:00'),
          schedules,
        ),
      ).toBe(true);
      expect(
        fitsSchedule(
          slot('2026-10-12T22:30:00', '2026-10-12T23:30:00'),
          schedules,
        ),
      ).toBe(false);
      expect(
        fitsSchedule(
          slot('2026-10-12T05:00:00', '2026-10-12T06:00:00'),
          schedules,
        ),
      ).toBe(false);
    });

    it('rechaza días cerrados', () => {
      const schedules = week('06:00', '23:00');
      schedules[0] = { dayOfWeek: DayOfWeek.MONDAY, isOpen: false };
      expect(
        fitsSchedule(
          slot('2026-10-12T19:00:00', '2026-10-12T20:00:00'),
          schedules,
        ),
      ).toBe(false);
    });

    it('permite cruzar la medianoche si el horario cierra al día siguiente', () => {
      const schedules = week('18:00', '02:00');
      expect(
        fitsSchedule(
          slot('2026-10-12T23:00:00', '2026-10-13T01:00:00'),
          schedules,
        ),
      ).toBe(true);
      // Domingo 01:00 viene del horario del sábado.
      expect(
        fitsSchedule(
          slot('2026-10-18T00:30:00', '2026-10-18T01:30:00'),
          schedules,
        ),
      ).toBe(true);
      expect(
        fitsSchedule(
          slot('2026-10-13T01:30:00', '2026-10-13T02:30:00'),
          schedules,
        ),
      ).toBe(false);
    });
  });

  describe('priceFor', () => {
    const rates = [
      {
        name: 'Diurna',
        pricePerHour: 60_000,
        days: WEEKDAYS,
        startTime: '06:00',
        endTime: '18:00',
      },
      {
        name: 'Nocturna',
        pricePerHour: 90_000,
        days: WEEKDAYS,
        startTime: '18:00',
        endTime: '23:00',
      },
    ];

    it('usa la tarifa de la franja', () => {
      expect(
        priceFor(
          slot('2026-10-12T19:00:00', '2026-10-12T20:30:00'),
          50_000,
          rates,
        ),
      ).toBe(135_000);
    });

    it('cobra cada fracción con su tarifa', () => {
      expect(
        priceFor(
          slot('2026-10-12T17:00:00', '2026-10-12T19:00:00'),
          50_000,
          rates,
        ),
      ).toBe(150_000);
    });

    it('usa el precio base donde no hay tarifa (fin de semana)', () => {
      expect(
        priceFor(
          slot('2026-10-17T10:00:00', '2026-10-17T11:00:00'),
          89_900,
          rates,
        ),
      ).toBe(89_900);
    });

    it('admite decimales', () => {
      expect(
        priceFor(slot('2026-10-17T10:00:00', '2026-10-17T11:30:00'), 12.5, []),
      ).toBe(18.75);
    });
  });

  describe('daySlots', () => {
    it('arma turnos completos desde la apertura, en hora local', () => {
      const slots = daySlots('2026-10-12', week('06:00', '09:30'), 60, OFFSET);
      expect(slots.map((s) => s.start.toISOString())).toEqual([
        '2026-10-12T11:00:00.000Z',
        '2026-10-12T12:00:00.000Z',
        '2026-10-12T13:00:00.000Z',
      ]);
    });

    it('incluye la madrugada del día siguiente si el horario pasa de medianoche', () => {
      const slots = daySlots('2026-10-16', week('22:00', '01:00'), 90, OFFSET);
      // Viernes 22:00–23:30 y 23:30–01:00 del sábado.
      expect(slots.map((s) => s.end.toISOString())).toEqual([
        '2026-10-17T04:30:00.000Z',
        '2026-10-17T06:00:00.000Z',
      ]);
    });

    it('no hay turnos en días cerrados', () => {
      const schedules = week('06:00', '23:00');
      schedules[6] = { dayOfWeek: DayOfWeek.SUNDAY, isOpen: false };
      expect(daySlots('2026-10-18', schedules, 60, OFFSET)).toEqual([]);
    });
  });
});
