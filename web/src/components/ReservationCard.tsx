import { Link } from 'react-router';
import { formatLongDay, formatMoney, formatTime, STATUS_LABELS } from '../lib/format';
import type { Reservation } from '../lib/types';
import { Card } from './ui';

/** Franja de color a la izquierda según el estado, como en la agenda de la app. */
const STATUS_BAR: Record<string, string> = {
  CONFIRMED: 'border-l-accent',
  COMPLETED: 'border-l-fg-3',
  NO_SHOW: 'border-l-warn',
  CANCELLED: 'border-l-danger',
};

/**
 * Estado para mostrar: una reserva confirmada cuya hora ya pasó cuenta como jugada
 * (así se cuentan también los partidos en las estadísticas).
 */
export function displayStatus(r: Pick<Reservation, 'status' | 'end'>, now = Date.now()): keyof typeof STATUS_LABELS {
  return r.status === 'CONFIRMED' && new Date(r.end).getTime() <= now ? 'COMPLETED' : r.status;
}

/** Tarjeta de una reserva del jugador; con `business` muestra y enlaza la sede. */
export function ReservationCard({
  reservation: r,
  business,
}: {
  reservation: Reservation;
  business?: { name: string; slug: string };
}) {
  const state = displayStatus(r);
  const status = STATUS_LABELS[state];
  const courts = r.group ? r.group.courts.map((c) => c.courtName).join(' + ') : r.courtName;
  const totalPrice = r.group?.totalPrice ?? r.totalPrice;
  const balance = r.group?.balance ?? r.balance;

  return (
    <Card className={`border-l-4 shadow-sm ${STATUS_BAR[state] ?? 'border-l-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {business && (
            <Link to={`/${business.slug}`} className="mb-0.5 block truncate text-xs font-semibold text-accent hover:underline">
              {business.name}
            </Link>
          )}
          <p className="font-bold tracking-tight">{formatLongDay(r.start)}</p>
          <p className="mt-0.5 text-sm text-fg-2">
            <span className="tabular font-semibold text-fg">
              {formatTime(r.start)} a {formatTime(r.end)}
            </span>{' '}
            · {courts}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border border-white/5 px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>
      {r.contactNote && <p className="mt-2 text-sm text-fg-2">📝 {r.contactNote}</p>}
      {r.cancellationReason && <p className="mt-2 text-sm text-danger">Motivo: {r.cancellationReason}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-sm">
        <span className="tabular text-fg-3">
          Total <b className="font-extrabold text-fg">{formatMoney(totalPrice, r.currency)}</b>
        </span>
        {r.status !== 'CANCELLED' &&
          (balance > 0 ? (
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              Pendiente {formatMoney(balance, r.currency)} · efectivo en la sede
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">Pagada</span>
          ))}
      </div>
    </Card>
  );
}
