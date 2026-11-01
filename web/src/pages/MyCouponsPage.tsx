import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { PitchBottomNav, PitchHeader, TicketIcon } from '../components/PitchChrome';
import { Alert, Skeleton } from '../components/ui';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';
import type { PlayerCoupon } from '../lib/types';
import { useApi } from '../lib/useApi';

const NEAR = 'near';
const ALL = 'all';

const isNear = (card: PlayerCoupon) =>
  card.status === 'EARNED' || (card.required > 0 && card.completed >= card.required) || card.remaining === 1;

/** "Mis cupones": mis tarjetas de fidelización de todas las sedes con Flip 3D. */
export function MyCouponsPage() {
  const { token } = useSession();
  const coupons = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);
  const summary = useApi<{ redeemed: number }>(token ? '/player/coupons/summary' : null, token);
  const [filter, setFilter] = useState(ALL);

  if (!token || coupons.status === 401) {
    return <Navigate to={accountPath('ingresar', '/cupones')} replace />;
  }

  const cards = coupons.data ?? [];
  const businesses = [...new Set(cards.map((card) => card.businessName))];
  const near = cards.filter(isNear);
  const visible =
    filter === ALL ? cards : filter === NEAR ? near : cards.filter((card) => card.businessName === filter);

  return (
    <>
      <PitchHeader />
      <div className="coupons-page pass-type">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8">
        {/* Encabezado y resumen */}
        <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl lg:text-5xl">Mis Cupones y Tarjetas</h1>
            <p className="mt-2 max-w-xl text-sm text-fg-3 sm:text-base">
              Lo que llevas y lo que te falta en cada sede. Toca cualquier tarjeta para{' '}
              <span className="font-medium text-(--cp-lime)">voltearla</span> y descubrir tus sellos acumulados.
            </p>
          </div>

          {coupons.data && (
            <dl className="grid w-full grid-cols-3 gap-3 sm:gap-4 lg:w-auto" aria-label="Resumen de cupones">
              <Stat label="Activos" value={cards.length} />
              <Stat
                label="Sellos totales"
                value={cards.reduce((sum, card) => sum + card.completed, 0)}
                valueClass="text-(--cp-neon)"
              />
              <Stat label="Canjeados" value={summary.data?.redeemed ?? '0'} valueClass="text-(--cp-lime)" />
            </dl>
          )}
        </section>

        {/* Mensajes de Error y Carga */}
        {coupons.error && <Alert>{coupons.error}</Alert>}

        {!coupons.data && !coupons.error && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            <Skeleton className="h-[510px] rounded-[1.25rem]" />
            <Skeleton className="h-[510px] rounded-[1.25rem]" />
          </div>
        )}

        {/* Estado Vacío */}
        {coupons.data?.length === 0 && (
          <div className="rounded-2xl border border-hairline bg-surface p-8 text-center shadow-sm space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 border border-hairline text-fg-3">
              <TicketIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display font-bold text-base text-fg">Aún no tienes tarjetas de fidelización</h2>
              <p className="text-xs text-fg-3 max-w-sm mx-auto leading-relaxed">
                Tus cartillas se activan y acumulan sellos automáticamente cuando juegas y pagas en sedes que ofrecen programas de recompensas.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-glow-accent transition hover:brightness-105 active:scale-95"
            >
              Explorar sedes deportivas
            </Link>
          </div>
        )}

        {/* Listado y Filtros */}
        {cards.length > 0 && (
          <>
            {/* Filtros por sede y estado */}
            <div
              className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto border-b border-(--cp-border) px-4 pb-4 sm:mx-0 sm:flex-wrap sm:px-0"
              role="group"
              aria-label="Filtrar cupones por sede o estado"
            >
              <FilterChip active={filter === ALL} onClick={() => setFilter(ALL)}>
                Todas las sedes ({cards.length})
              </FilterChip>

              {businesses.length > 1 &&
                businesses.map((name) => (
                  <FilterChip key={name} active={filter === name} onClick={() => setFilter(name)}>
                    {name} ({cards.filter((card) => card.businessName === name).length})
                  </FilterChip>
                ))}

              {near.length > 0 && (
                <FilterChip active={filter === NEAR} onClick={() => setFilter(NEAR)} highlight>
                  <span className="size-1.5 rounded-full bg-current" />
                  Cerca de reclamar ({near.length})
                </FilterChip>
              )}
            </div>

            {/* Grilla de cupones */}
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {visible.map((card) => (
                <li key={card.couponId} className="min-w-0">
                  <LoyaltyCard card={card} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      </div>
      <PitchBottomNav />
    </>
  );
}

function Stat({
  label,
  value,
  valueClass = 'text-fg',
}: {
  label: string;
  value: number | string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col-reverse rounded-2xl border border-(--cp-border) bg-(--cp-panel) p-3.5 text-center sm:p-4 lg:min-w-32">
      <dt className="text-[11px] uppercase tracking-wider text-fg-3 sm:text-xs">{label}</dt>
      <dd className={`font-display text-xl font-bold sm:text-2xl ${valueClass}`}>{value}</dd>
    </div>
  );
}

function FilterChip({
  active,
  highlight = false,
  onClick,
  children,
}: {
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? 'bg-(--cp-chip-on) text-(--cp-chip-on-fg) shadow-md'
          : `border border-(--cp-border) bg-(--cp-panel) hover:border-(--cp-neon) ${highlight ? 'text-(--cp-neon)' : 'text-fg-2 hover:text-fg'}`
      }`}
    >
      {children}
    </button>
  );
}
