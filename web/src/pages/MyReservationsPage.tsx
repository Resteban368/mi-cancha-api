import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { BusinessHeader, PitchBottomNav } from '../components/PitchChrome';
import { ReservationCard } from '../components/ReservationCard';
import { Alert, Card, Skeleton } from '../components/ui';
import { useSession } from '../lib/session';
import { accountPath } from '../lib/next';
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
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95"
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
      {items.map((r) => (
        <ReservationCard key={r.id} reservation={r} />
      ))}
    </section>
  );
}
