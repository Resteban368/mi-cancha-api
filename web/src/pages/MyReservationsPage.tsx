import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Card, Skeleton } from '../components/ui';
import { formatLongDay, formatMoney, formatTime, STATUS_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import type { PublicBusiness, Reservation } from '../lib/types';
import { useApi } from '../lib/useApi';

export function MyReservationsPage() {
  const { slug = '' } = useParams();
  const { token, signOut } = useSession();
  const business = useApi<PublicBusiness>(`/public/businesses/${slug}`);
  const reservations = useApi<Reservation[]>(token ? `/player/businesses/${slug}/reservations` : null, token);

  // Token vencido: se cierra la sesión y se pide ingresar de nuevo.
  useEffect(() => {
    if (reservations.status === 401) signOut();
  }, [reservations.status, signOut]);

  if (!token) return <Navigate to={`/${slug}/ingresar`} replace />;

  const now = Date.now();
  const upcoming = reservations.data?.filter((r) => new Date(r.end).getTime() > now).reverse() ?? [];
  const past = reservations.data?.filter((r) => new Date(r.end).getTime() <= now) ?? [];

  return (
    <>
      <Header slug={slug} businessName={business.data?.name} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Mis reservas</h1>
          <Link to={`/${slug}`} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg">
            Nueva reserva
          </Link>
        </div>
        {reservations.error && reservations.status !== 401 && <Alert>{reservations.error}</Alert>}
        {reservations.loading && !reservations.data ? (
          <Skeleton className="h-40" />
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
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: Reservation[]; empty?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-3">{title}</h2>
      {items.length === 0 && empty && <p className="text-sm text-fg-2">{empty}</p>}
      {items.map((r) => {
        const status = STATUS_LABELS[r.status];
        return (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{formatLongDay(r.start)}</p>
                <p className="text-sm text-fg-2">
                  {formatTime(r.start)} a {formatTime(r.end)} · {r.courtName}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
            </div>
            {r.contactNote && <p className="mt-2 text-sm text-fg-2">📝 {r.contactNote}</p>}
            {r.cancellationReason && <p className="mt-2 text-sm text-danger">Motivo: {r.cancellationReason}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="tabular">Total {formatMoney(r.totalPrice, r.currency)}</span>
              {r.status !== 'CANCELLED' &&
                (r.balance > 0 ? (
                  <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
                    Pendiente {formatMoney(r.balance, r.currency)} · efectivo en la sede
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
