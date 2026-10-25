import { useEffect } from 'react';
import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { ChevronRightIcon, PinIcon, PitchBottomNav } from '../components/PitchChrome';
import { Alert, Card, Skeleton } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { PlayerBusiness } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mis sedes": los lugares donde ya soy cliente, con acceso a mis reservas en cada uno. */
export function MySitesPage() {
  const { token, signOut } = useSession();
  const sites = useApi<PlayerBusiness[]>(token ? '/player/businesses' : null, token);

  useEffect(() => {
    if (sites.status === 401) signOut();
  }, [sites.status, signOut]);

  if (!token || sites.status === 401) return <Navigate to={accountPath('ingresar', '/mis-sedes')} replace />;

  const count = sites.data?.length ?? 0;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-28 pt-5 sm:pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mis sedes</h1>
          <p className="mt-1 text-sm text-fg-3">Aquí aparecen las sedes donde ya tienes reservas.</p>
        </div>

        {sites.error && sites.status !== 401 && <Alert>{sites.error}</Alert>}

        {!sites.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : count === 0 ? (
          <Card className="flex flex-col items-start gap-1 shadow-sm">
            <span className="mb-1 text-3xl" aria-hidden="true">
              🏟️
            </span>
            <p className="font-semibold">Todavía no tienes sedes.</p>
            <p className="text-sm text-fg-3">Reserva en una sede y quedará aquí para volver cuando quieras.</p>
            <Link
              to="/"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110"
            >
              Ver sedes
              <ChevronRightIcon className="size-4" strokeWidth={2.5} />
            </Link>
          </Card>
        ) : (
          <>
            <p className="text-xs font-medium text-fg-3" aria-live="polite">
              Mostrando{' '}
              <b className="font-bold text-fg">
                {count} {count === 1 ? 'sede' : 'sedes'}
              </b>
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(sites.data ?? []).map((site) => (
                <li key={site.slug}>
                  <SiteCard site={site} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <PitchBottomNav />
    </>
  );
}

function SiteCard({ site }: { site: PlayerBusiness }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-lg">
      <Link
        to={`/${site.slug}`}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="relative h-36 w-full overflow-hidden bg-surface-2">
          {site.imageUrl ? (
            <img
              src={site.imageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-5xl" aria-hidden="true">
              🏟️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/10 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg shadow-sm backdrop-blur-md">
            Ya eres cliente
          </span>
        </div>
        <div className="px-4 pt-3">
          <h2 className="truncate text-base font-bold tracking-tight">{site.name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-3">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {site.neighborhood} · {site.address}
            </span>
          </p>
          <p className="mt-1.5 text-[11px] text-fg-3">Cliente desde {formatSince(site.clientSince)}</p>
        </div>
      </Link>
      <div className="mt-auto flex gap-2 p-4 pt-3">
        <Link
          to={`/${site.slug}/mis-reservas`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-hairline bg-surface-2 px-3 text-xs font-semibold transition hover:border-fg-3 active:scale-95"
        >
          Mis reservas
        </Link>
        <Link
          to={`/${site.slug}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95"
        >
          Reservar
          <ChevronRightIcon className="size-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </article>
  );
}

function formatSince(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(
    new Date(iso),
  );
}
