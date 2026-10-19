import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { BusinessHeader, PitchBottomNav } from '../components/PitchChrome';
import { Alert, Card, Skeleton } from '../components/ui';
import { formatLongDay, formatMoney, formatTime, STATUS_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import { accountPath } from '../lib/next';
import type { PublicBusiness, Reservation } from '../lib/types';
import { useApi } from '../lib/useApi';

/** Franja de color a la izquierda según el estado, como en la agenda de la app. */
const STATUS_BAR: Record<string, string> = {
  CONFIRMED: 'border-l-accent',
  COMPLETED: 'border-l-fg-3',
  NO_SHOW: 'border-l-warn',
  CANCELLED: 'border-l-danger',
};

export function MyReservationsPage() {
  const { slug = '' } = useParams();
  const { token, signOut } = useSession();
  const business = useApi<PublicBusiness>(`/public/businesses/${slug}`);
  const reservations = useApi<Reservation[]>(token ? `/player/businesses/${slug}/reservations` : null, token);

  // Token vencido: se cierra la sesión y se pide ingresar de nuevo.
  useEffect(() => {
    if (reservations.status === 401) signOut();
  }, [reservations.status, signOut]);

  if (!token) return <Navigate to={accountPath('ingresar', `/${slug}/mis-reservas`)} replace />;

  const now = Date.now();
  // Una reserva de varias canchas llega como una fila por cancha: se muestra una vez.
  const seen = new Set<string>();
  const list = (reservations.data ?? []).filter((r) => {
    if (!r.group) return true;
    if (seen.has(r.group.id)) return false;
    seen.add(r.group.id);
    return true;
  });
  const upcoming = list.filter((r) => new Date(r.end).getTime() > now).reverse();
  const past = list.filter((r) => new Date(r.end).getTime() <= now);

  return (
    <>
      <BusinessHeader slug={slug} name={business.data?.name} address={business.data?.address} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-28 pt-5 sm:pb-12">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Mis reservas</h2>
            <p className="mt-0.5 text-xs text-fg-3">Tus turnos en esta sede.</p>
          </div>
          <Link
            to={`/${slug}`}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-fg shadow-md shadow-emerald-500/20 transition hover:brightness-110 active:scale-95"
          >
            Nueva reserva
          </Link>
        </div>
        {reservations.error && reservations.status !== 401 && <Alert>{reservations.error}</Alert>}
        {reservations.loading && !reservations.data ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (
          <>
            <Section title="Próximas" items={upcoming} empty="No tienes reservas próximas en esta sede." />
            {past.length > 0 && <Section title="Anteriores" items={past} />}
          </>
        )}
        <p className="text-center text-xs text-fg-3">
          Para cancelar o cambiar una reserva, comunícate con la sede.
        </p>
      </main>
      <PitchBottomNav />
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: Reservation[]; empty?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-3">{title}</h3>
      {items.length === 0 && empty && (
        <Card className="text-sm text-fg-3 shadow-sm">
          <span aria-hidden="true">📅 </span>
          {empty}
        </Card>
      )}
      {items.map((r) => {
        const status = STATUS_LABELS[r.status];
        const courts = r.group ? r.group.courts.map((c) => c.courtName).join(' + ') : r.courtName;
        const totalPrice = r.group?.totalPrice ?? r.totalPrice;
        const balance = r.group?.balance ?? r.balance;
        return (
          <Card key={r.id} className={`border-l-4 shadow-sm ${STATUS_BAR[r.status] ?? 'border-l-border'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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
      })}
    </section>
  );
}
