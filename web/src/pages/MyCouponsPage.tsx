import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { BoltIcon, PitchBottomNav, PitchHeader, SparklesIcon, TicketIcon } from '../components/PitchChrome';
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
  const earned = cards.filter((c) => c.status === 'EARNED' || (c.required > 0 && c.completed >= c.required));
  const visible =
    filter === ALL ? cards : filter === NEAR ? near : cards.filter((card) => card.businessName === filter);

  return (
    <>
      <PitchHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-3.5 pb-28 pt-3 sm:gap-5 sm:px-4 sm:pb-14 sm:pt-4">
        {/* Encabezado Principal */}
        <section className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-text uppercase shadow-sm">
            <SparklesIcon className="size-3" />
            Club de Beneficios · Sellos
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-fg">
            Mis cupones y tarjetas
          </h1>
          <p className="text-xs text-fg-3 sm:text-sm">
            Tus recompensas acumuladas en cada sede. Toca cualquier tarjeta para{' '}
            <span className="font-semibold text-accent-text">voltearla</span> y ver tus sellos.
          </p>
        </section>

        {/* Resumen de Estadísticas */}
        {coupons.data && (
          <section className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Resumen de cupones">
            <Stat label="Activos" value={cards.length} icon={<TicketIcon className="size-4 text-fg-3" />} />
            <Stat
              label="Sellos"
              value={cards.reduce((sum, card) => sum + card.completed, 0)}
              icon={<SparklesIcon className="size-4 text-accent-text" />}
              accent
            />
            <Stat
              label="Canjeados"
              value={summary.data?.redeemed ?? '0'}
              icon={<BoltIcon className="size-4 text-fg-3" />}
            />
          </section>
        )}

        {/* Mensajes de Error y Carga */}
        {coupons.error && <Alert>{coupons.error}</Alert>}

        {!coupons.data && !coupons.error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[450px] rounded-2xl" />
            <Skeleton className="h-[450px] rounded-2xl" />
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
            {/* Filtros Horizontales (chips) */}
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 py-1 sm:-mx-4 sm:px-4"
              role="group"
              aria-label="Filtrar cupones por sede o estado"
            >
              <FilterChip active={filter === ALL} onClick={() => setFilter(ALL)}>
                <span>Todas ({cards.length})</span>
              </FilterChip>

              {near.length > 0 && (
                <FilterChip active={filter === NEAR} onClick={() => setFilter(NEAR)} highlight>
                  <span className="flex size-1.5 rounded-full bg-accent" />
                  <span>
                    {earned.length > 0 ? `Por reclamar (${near.length})` : `Cerca de ganar (${near.length})`}
                  </span>
                </FilterChip>
              )}

              {businesses.length > 1 &&
                businesses.map((name) => (
                  <FilterChip key={name} active={filter === name} onClick={() => setFilter(name)}>
                    <span>{name} ({cards.filter((card) => card.businessName === name).length})</span>
                  </FilterChip>
                ))}
            </div>

            {/* Grilla de Cupones */}
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((card) => (
                <li key={card.couponId} className="min-w-0">
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

function Stat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 sm:p-3.5 text-center transition-all ${
        accent
          ? 'border-accent/40 bg-accent/10 shadow-sm'
          : 'border-hairline bg-surface shadow-sm'
      }`}
    >
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <dd
          className={`font-display text-lg sm:text-xl font-extrabold tabular-nums tracking-tight ${
            accent ? 'text-accent-text' : 'text-fg'
          }`}
        >
          {value}
        </dd>
      </div>
      <dt className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-fg-3 mt-0.5">
        {label}
      </dt>
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
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-sm ${
        active
          ? 'bg-accent text-accent-fg shadow-glow-accent'
          : highlight
            ? 'border border-accent/30 bg-accent/10 text-accent-text hover:bg-accent/20'
            : 'border border-hairline bg-surface text-fg-2 hover:border-fg-3 hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
