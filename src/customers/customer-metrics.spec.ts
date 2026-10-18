import {
  PaymentStatus,
  ReservationStatus,
  Sport,
} from '../generated/prisma/enums.js';
import { computeMetrics } from './customer-metrics.js';

const now = new Date('2030-10-22T12:00:00Z');
const played = new Date('2030-10-21T23:00:00Z');

describe('computeMetrics', () => {
  it('una reserva de varias canchas cuenta como una y su pago cubre el grupo', () => {
    const m = computeMetrics(
      [
        {
          id: 'r-1',
          groupId: 'g-1',
          status: ReservationStatus.COMPLETED,
          start: played,
          totalPrice: 120_000,
          courtName: 'Sintética 1',
          sport: Sport.FUTBOL,
          // El pago del grupo queda en la primera reserva.
          payments: [{ amount: 240_000, status: PaymentStatus.APPROVED }],
        },
        {
          id: 'r-2',
          groupId: 'g-1',
          status: ReservationStatus.COMPLETED,
          start: played,
          totalPrice: 120_000,
          courtName: 'Sintética 2',
          sport: Sport.FUTBOL,
          payments: [],
        },
        {
          id: 'r-3',
          groupId: null,
          status: ReservationStatus.CONFIRMED,
          start: played,
          totalPrice: 100_000,
          courtName: 'Pádel 1',
          sport: Sport.PADEL,
          payments: [],
        },
      ],
      now,
    );

    expect(m.reservations).toBe(2);
    expect(m.totalSpent).toBe(240_000);
    // El grupo está pagado completo; solo debe la reserva de pádel.
    expect(m.balance).toBe(100_000);
    expect(m.attendancePct).toBe(100);
  });

  it('la última visita de un grupo nombra sus canchas juntas', () => {
    const m = computeMetrics(
      ['Sintética 1', 'Sintética 2'].map((courtName, i) => ({
        id: `r-${i}`,
        groupId: 'g-1',
        status: ReservationStatus.COMPLETED,
        start: played,
        totalPrice: 50_000,
        courtName,
        sport: Sport.FUTBOL,
        payments: [],
      })),
      now,
    );
    expect(m.lastVisit).toEqual({
      date: played,
      courtName: 'Sintética 1 + Sintética 2',
    });
  });
});
