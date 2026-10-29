import { PaymentStatus } from '../generated/prisma/enums.js';
import { splitPayments } from './payment-split.js';

const at = (hour: number) => new Date(2026, 9, 29, hour);
const pay = (
  id: string,
  amount: number,
  hour: number,
  extra: Partial<{
    status: PaymentStatus;
    reservationId: string | null;
    saleId: string | null;
  }> = {},
) => ({
  id,
  amount,
  receivedAt: at(hour),
  status: PaymentStatus.APPROVED,
  reservationId: 'r1',
  saleId: null,
  ...extra,
});
const reservation = (
  id: string,
  totalPrice: number,
  chargedConsumptions: number,
  groupId: string | null = null,
) => ({
  id,
  groupId,
  totalPrice,
  chargedConsumptions,
});

describe('splitPayments', () => {
  it('cancha 60.000 + consumos 57.000 pagados con 110.000', () => {
    const split = splitPayments(
      [pay('p1', 110_000, 9)],
      [reservation('r1', 60_000, 57_000)],
    );
    expect(split.get('p1')).toEqual({ court: 60_000, products: 50_000 });
  });

  it('anticipo y saldo: el primero va a la cancha', () => {
    const split = splitPayments(
      [pay('p2', 77_000, 10), pay('p1', 30_000, 8)],
      [reservation('r1', 60_000, 47_000)],
    );
    expect(split.get('p1')).toEqual({ court: 30_000, products: 0 });
    expect(split.get('p2')).toEqual({ court: 30_000, products: 47_000 });
  });

  it('lo que sobra queda como cancha', () => {
    const split = splitPayments(
      [pay('p1', 70_000, 9)],
      [reservation('r1', 60_000, 5_000)],
    );
    expect(split.get('p1')).toEqual({ court: 65_000, products: 5_000 });
  });

  it('pago de una venta: todo productos; sin reserva ni venta: cancha', () => {
    const split = splitPayments(
      [
        pay('venta', 10_000, 9, { reservationId: null, saleId: 's1' }),
        pay('otro', 5_000, 9, { reservationId: null }),
      ],
      [],
    );
    expect(split.get('venta')).toEqual({ court: 0, products: 10_000 });
    expect(split.get('otro')).toEqual({ court: 5_000, products: 0 });
  });

  it('un grupo de canchas se reparte como una sola cuenta', () => {
    const split = splitPayments(
      [pay('p1', 150_000, 9, { reservationId: 'r2' })],
      [
        reservation('r1', 60_000, 20_000, 'g1'),
        reservation('r2', 60_000, 0, 'g1'),
      ],
    );
    expect(split.get('p1')).toEqual({ court: 130_000, products: 20_000 });
  });

  it('un pago pendiente se reparte sobre lo que falta tras los aprobados', () => {
    const split = splitPayments(
      [
        pay('p1', 60_000, 8),
        pay('p2', 20_000, 9, { status: PaymentStatus.PENDING }),
      ],
      [reservation('r1', 60_000, 15_000)],
    );
    expect(split.get('p1')).toEqual({ court: 60_000, products: 0 });
    expect(split.get('p2')).toEqual({ court: 5_000, products: 15_000 });
  });
});
