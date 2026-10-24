import { useEffect } from 'react';
import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { PitchBottomNav } from '../components/PitchChrome';
import { ReservationHistory, StatsPanel } from '../components/PlayerActivity';
import { Alert } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { Player } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mis reservas": todas mis reservas de todas las sedes, con resumen, filtros y agrupación. */
export function MyBookingsPage() {
  const { token, signOut } = useSession();
  const me = useApi<Player>(token ? '/player/me' : null, token);

  useEffect(() => {
    if (me.status === 401) signOut();
  }, [me.status, signOut]);

  if (!token) return <Navigate to={accountPath('ingresar', '/reservas')} replace />;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-28 pt-5 sm:pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mis reservas</h1>
          <p className="mt-0.5 text-xs text-fg-3">Tus partidos en todas las sedes, próximos y pasados.</p>
        </div>

        {me.data && (!me.data.email || !me.data.documentId) && (
          <Alert tone="warn">
            Completa tu {[!me.data.email && 'correo', !me.data.documentId && 'cédula'].filter(Boolean).join(' y ')}: las sedes
            los usan para identificarte al llegar.{' '}
            <Link to="/perfil" className="font-semibold underline">
              Ir a Mi perfil
            </Link>
          </Alert>
        )}
        <StatsPanel token={token} />
        <ReservationHistory token={token} />
      </main>
      <PitchBottomNav />
    </>
  );
}
