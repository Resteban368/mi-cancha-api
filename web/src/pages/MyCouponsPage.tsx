import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Header } from '../components/Header';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { PitchBottomNav } from '../components/PitchChrome';
import { Alert, Skeleton } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { PlayerCoupon } from '../lib/types';
import { useApi } from '../lib/useApi';

const NEAR = 'near';
const ALL = 'all';

const isNear = (card: PlayerCoupon) => card.status === 'EARNED' || card.remaining === 1;

/** "Mis cupones": mis tarjetas de todas las sedes, que se voltean para ver sus sellos. */
export function MyCouponsPage() {
  const { token } = useSession();
  const coupons = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);
  const summary = useApi<{ redeemed: number }>(token ? '/player/coupons/summary' : null, token);
  const [filter, setFilter] = useState(ALL);

  if (!token || coupons.status === 401) return <Navigate to={accountPath('ingresar', '/cupones')} replace />;

  const cards = coupons.data ?? [];
  const businesses = [...new Set(cards.map((card) => card.businessName))];
  const near = cards.filter(isNear);
  const visible = filter === ALL ? cards : filter === NEAR ? near : cards.filter((card) => card.businessName === filter);

  return (
    <>
      <Header />
      <main className="bg-pitch-pattern mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Mis cupones y tarjetas</h1>
            <p className="mt-2 max-w-xl text-sm text-fg-2 sm:text-base">
              Lo que llevas y lo que te falta en cada sede. Toca una tarjeta para{' '}
              <span className="font-medium text-accent-text">voltearla</span> y ver tus sellos.
            </p>
          </div>
          {coupons.data && (
            <dl className="grid w-full grid-cols-3 gap-3 sm:gap-4 lg:w-auto">
              <Stat label="Activos" value={cards.length} />
              <Stat label="Sellos" value={cards.reduce((sum, card) => sum + card.completed, 0)} accent />
              <Stat label="Canjeados" value={summary.data?.redeemed ?? '–'} />
            </dl>
          )}
        </div>

        {coupons.error && <Alert>{coupons.error}</Alert>}
        {!coupons.data && !coupons.error && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            <Skeleton className="h-[510px] rounded-[1.25rem]" />
            <Skeleton className="h-[510px] rounded-[1.25rem]" />
          </div>
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
        {cards.length > 0 && (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-4" role="group" aria-label="Filtrar cupones">
              <FilterButton active={filter === ALL} onClick={() => setFilter(ALL)}>
                Todas las sedes ({cards.length})
              </FilterButton>
              {businesses.length > 1 &&
                businesses.map((name) => (
                  <FilterButton key={name} active={filter === name} onClick={() => setFilter(name)}>
                    {name} ({cards.filter((card) => card.businessName === name).length})
                  </FilterButton>
                ))}
              {near.length > 0 && (
                <FilterButton active={filter === NEAR} onClick={() => setFilter(NEAR)}>
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                  Cerca de reclamar ({near.length})
                </FilterButton>
              )}
            </div>
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {visible.map((card) => (
                <li key={card.couponId}>
                  <LoyaltyCard card={card} />
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

function Stat({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 text-center sm:p-4">
      <dd className={`text-xl font-extrabold tabular-nums sm:text-2xl ${accent ? 'text-accent-text' : ''}`}>{value}</dd>
      <dt className="text-[11px] uppercase tracking-wider text-fg-3 sm:text-xs">{label}</dt>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition sm:text-sm ${
        active ? 'bg-accent text-accent-fg' : 'border border-border bg-surface text-fg-2 hover:border-accent hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
