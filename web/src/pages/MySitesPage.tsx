import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Card, Skeleton } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { PlayerBusiness } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mis sedes": los lugares donde ya soy cliente, con acceso a mis reservas en cada uno. */
export function MySitesPage() {
  const { token, signOut } = useSession();
  const sites = useApi<PlayerBusiness[]>(token ? '/player/businesses' : null, token);

  if (!token) return <Navigate to={accountPath('ingresar', '/mis-sedes')} replace />;
  if (sites.status === 401) {
    signOut();
    return <Navigate to={accountPath('ingresar', '/mis-sedes')} replace />;
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Mis sedes</h1>
          <p className="mt-1 text-sm text-fg-2">Aquí aparecen las sedes donde ya tienes reservas.</p>
        </div>

        {sites.error && sites.status !== 401 && <Alert>{sites.error}</Alert>}

        {!sites.data ? (
          <Skeleton className="h-40" />
        ) : sites.data.length === 0 ? (
          <Card>
            <p className="font-semibold">Todavía no tienes sedes.</p>
            <p className="mt-1 text-sm text-fg-2">Reserva en una sede y quedará aquí para volver cuando quieras.</p>
            <Link to="/" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
              Ver sedes
            </Link>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sites.data.map((site) => (
              <li key={site.slug}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{site.name}</h2>
                    <p className="truncate text-sm text-fg-2">
                      {site.neighborhood} · {site.address}
                    </p>
                    <p className="mt-1 text-xs text-fg-3">Cliente desde {formatSince(site.clientSince)}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Link
                      to={`/${site.slug}/mis-reservas`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-fg hover:bg-surface-2"
                    >
                      Mis reservas
                    </Link>
                    <Link
                      to={`/${site.slug}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
                    >
                      Reservar
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function formatSince(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(
    new Date(iso),
  );
}
