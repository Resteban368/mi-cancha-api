import { useEffect } from 'react';
import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { ArrowForwardIcon, PinIcon, PitchBottomNav, VerifiedIcon } from '../components/PitchChrome';
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
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-28 pt-4 sm:pb-14">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Mis sedes</h1>
          <p className="mt-1 text-xs text-fg-3 sm:text-sm">Aquí aparecen las sedes donde ya tienes historial o reservas.</p>
        </div>

        {sites.error && sites.status !== 401 && <Alert>{sites.error}</Alert>}

        {!sites.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : count === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-4xl" aria-hidden="true">
              🏟️
            </span>
            <p className="text-base font-bold text-fg">Todavía no tienes sedes.</p>
            <p className="mt-1 text-xs text-fg-3 max-w-xs">
              Reserva en una sede y quedará guardada aquí para volver cuando quieras.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg shadow-glow-accent transition hover:brightness-110 active:scale-95"
            >
              <span>Explorar sedes</span>
              <ArrowForwardIcon className="size-4 stroke-[2.5]" />
            </Link>
          </Card>
        ) : (
          <>
            <p className="text-xs font-medium text-fg-3" aria-live="polite">
              Mostrando{' '}
              <b className="font-extrabold text-fg">
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
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-md dark:shadow-none transition-all hover:border-accent/50 hover:shadow-lg">
      <Link
        to={`/${site.slug}`}
        className="block focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className="relative h-40 w-full overflow-hidden bg-surface-2">
          {site.imageUrl ? (
            <img
              src={site.imageUrl}
              alt={site.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-surface-2 text-5xl" aria-hidden="true">
              🏟️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/25 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold text-accent-fg shadow-lg">
            <VerifiedIcon className="size-3.5" />
            <span>Ya eres cliente</span>
          </span>
        </div>
        <div className="p-4 pb-2">
          <h2 className="font-display text-base font-bold text-fg leading-snug group-hover:text-accent-text transition-colors truncate">
            {site.name}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-fg-3">
            <PinIcon className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">
              {site.neighborhood} · {site.address}
            </span>
          </p>
          <p className="mt-2 text-[11px] font-medium text-fg-3">Cliente desde {formatSince(site.clientSince)}</p>
        </div>
      </Link>
      <div className="mt-auto flex gap-2 p-4 pt-2">
        <Link
          to={`/${site.slug}/mis-reservas`}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-hairline bg-surface-2 px-3 text-xs font-semibold text-fg-2 transition hover:border-accent/40 active:scale-95"
        >
          Mis reservas
        </Link>
        <Link
          to={`/${site.slug}`}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-accent-fg shadow-glow-accent transition hover:brightness-110 active:scale-95"
        >
          <span>Reservar</span>
          <ArrowForwardIcon className="size-3.5 stroke-[2.5]" />
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
