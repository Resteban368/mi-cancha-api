import { Link, Navigate } from 'react-router';
import { MyCouponCard } from '../components/Coupons';
import { Header } from '../components/Header';
import { PitchBottomNav } from '../components/PitchChrome';
import { Alert, Skeleton } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { PlayerCoupon } from '../lib/types';
import { useApi } from '../lib/useApi';

/** "Mis cupones": mi avance en los cupones de todas las sedes. */
export function MyCouponsPage() {
  const { token } = useSession();
  const coupons = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);

  if (!token || coupons.status === 401) return <Navigate to={accountPath('ingresar', '/cupones')} replace />;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-28 pt-5 sm:pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mis cupones</h1>
          <p className="mt-0.5 text-xs text-fg-3">Lo que llevas y lo que te falta en cada sede.</p>
        </div>

        {coupons.error && <Alert>{coupons.error}</Alert>}
        {!coupons.data && !coupons.error && (
          <>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </>
        )}
        {coupons.data?.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-fg-2">
              Aún no tienes cupones. Se empiezan a llenar cuando juegas y pagas una reserva en una sede que los ofrece.
            </p>
            <Link to="/" className="mt-3 inline-block text-sm font-semibold text-accent-text hover:underline">
              Explorar sedes
            </Link>
          </div>
        )}
        {coupons.data && coupons.data.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {coupons.data.map((card) => (
              <li key={card.couponId}>
                <MyCouponCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <PitchBottomNav />
    </>
  );
}
