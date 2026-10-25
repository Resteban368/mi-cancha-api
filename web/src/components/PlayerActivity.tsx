import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { bogotaDateOf, formatLongDay, formatMoney, formatTime, SPORT_EMOJI, SPORT_LABELS, STATUS_LABELS } from '../lib/format';
import type { PlayerBusiness, PlayerReservation, PlayerReservationPage, PlayerStats, ReservationFilter, Sport } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ChevronDownIcon, ChevronRightIcon } from './PitchChrome';
import { displayStatus, ReservationCard } from './ReservationCard';
import { Alert, Button, Card, Skeleton } from './ui';

const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "2026-09" → "Sep". */
const monthLabel = (month: string) => capitalize(monthShort.format(new Date(`${month}-15T12:00:00Z`)).replace('.', ''));

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-CO')} ${n === 1 ? one : many}`;

/** Resumen pequeño: cuánto he jugado, lo próximo y la actividad de los últimos meses. */
export function StatsPanel({ token }: { token: string }) {
  const stats = useApi<PlayerStats>('/player/stats', token);

  if (stats.error && !stats.data) return <Alert>{stats.error}</Alert>;
  if (!stats.data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  const s = stats.data;
  const maxMonth = Math.max(1, ...s.byMonth.map((m) => m.played));

  return (
    <section aria-label="Mi resumen" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Partidos jugados" value={s.played} icon="⚽" highlight />
        <Stat label="Horas de juego" value={s.hoursPlayed} icon="⏱️" />
        <Stat label="Próximas" value={s.upcoming} icon="📅" />
        <Stat label="Canceladas" value={s.cancelled} icon="✖️" />
      </div>

      {s.next && (
        <Link
          to={`/${s.next.businessSlug}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4 transition hover:border-accent/40"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-text">Próximo partido</p>
            <p className="truncate font-bold tracking-tight">
              {formatLongDay(s.next.start)} · {formatTime(s.next.start)}
            </p>
            <p className="truncate text-xs text-fg-2">
              {s.next.businessName} · {s.next.courtName}
            </p>
          </div>
          <ChevronRightIcon className="size-4 shrink-0 text-accent-text" strokeWidth={2.5} />
        </Link>
      )}

      {s.played > 0 && (
        <Card className="grid gap-4 shadow-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-3">Tu juego</h3>
            {s.favoriteSport && (
              <Fact
                label="Deporte favorito"
                value={`${SPORT_EMOJI[s.favoriteSport]} ${SPORT_LABELS[s.favoriteSport]}`}
                hint={plural(s.bySport[0]?.played ?? 0, 'partido', 'partidos')}
              />
            )}
            {s.topBusiness && (
              <Fact
                label="Sede más visitada"
                value={s.topBusiness.name}
                hint={plural(s.topBusiness.played, 'partido', 'partidos')}
                to={s.topBusiness.slug ? `/${s.topBusiness.slug}` : undefined}
              />
            )}
            <Fact label="Valor de tus partidos" value={formatMoney(s.spent, s.currency)} hint="Según las tarifas, pagado en la sede" />
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-3">Partidos por mes</h3>
            <ol className="flex h-28 items-end gap-2" aria-label="Partidos jugados en los últimos 6 meses">
              {s.byMonth.map((m) => (
                <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="tabular text-[11px] font-semibold text-fg-2">{m.played > 0 ? m.played : ''}</span>
                  <span
                    className={`w-full rounded-t-md ${m.played > 0 ? 'bg-accent' : 'bg-surface-2'}`}
                    style={{ height: `${Math.max(6, (m.played / maxMonth) * 70)}%` }}
                    title={`${monthLabel(m.month)}: ${plural(m.played, 'partido', 'partidos')}`}
                  />
                  <span className="text-[10px] text-fg-3">{monthLabel(m.month)}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      {s.total === 0 && (
        <Card className="text-sm text-fg-3 shadow-sm">
          Todavía no has reservado. Cuando juegues, aquí verás tus partidos, tus horas y tu deporte favorito.
        </Card>
      )}
    </section>
  );
}

function Stat({ label, value, icon, highlight = false }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-sm ${
        highlight ? 'border-accent/30 bg-accent-soft' : 'border-border bg-surface'
      }`}
    >
      <span className="text-lg" aria-hidden="true">
        {icon}
      </span>
      <p className={`tabular mt-1 text-3xl font-extrabold leading-none tracking-tight ${highlight ? 'text-accent-text' : ''}`}>
        {value.toLocaleString('es-CO')}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-fg-3">{label}</p>
    </div>
  );
}

function Fact({ label, value, hint, to }: { label: string; value: string; hint?: string; to?: string }) {
  const body = (
    <>
      <span className="block text-[11px] text-fg-3">{label}</span>
      <span className="block truncate text-sm font-semibold">{value}</span>
      {hint && <span className="block text-[11px] text-fg-3">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-xl transition hover:bg-hover">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

const FILTERS: { value: ReservationFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'UPCOMING', label: 'Próximas' },
  { value: 'PLAYED', label: 'Jugadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'NO_SHOW', label: 'No asistí' },
];

const PAGE_SIZE = 20;

type GroupBy = 'date' | 'site' | 'status' | 'none';

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'date', label: 'Fecha' },
  { value: 'site', label: 'Sede' },
  { value: 'status', label: 'Estado' },
  { value: 'none', label: 'Sin agrupar' },
];

const monthLong = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Sección a la que pertenece una reserva según cómo se agrupe la lista. */
function groupOf(r: PlayerReservation, by: GroupBy): { key: string; label: string } {
  if (by === 'site') return { key: r.businessSlug, label: r.businessName };
  if (by === 'status') {
    const state = displayStatus(r);
    return { key: state, label: STATUS_LABELS[state]?.label ?? state };
  }
  if (by === 'date') {
    const month = bogotaDateOf(r.start).slice(0, 7);
    return { key: month, label: capitalize(monthLong.format(new Date(`${month}-15T12:00:00Z`))) };
  }
  return { key: 'all', label: '' };
}

/** Agrupa conservando el orden de la lista (ya viene por fecha). */
function groupReservations(items: PlayerReservation[], by: GroupBy) {
  const groups = new Map<string, { label: string; items: PlayerReservation[] }>();
  for (const r of items) {
    const { key, label } = groupOf(r, by);
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(r);
    groups.set(key, group);
  }
  return [...groups.values()];
}

interface Listing {
  items: PlayerReservation[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
}

/** Todas mis reservas en todas las sedes, con filtros por estado, sede y deporte. */
export function ReservationHistory({ token }: { token: string }) {
  const [status, setStatus] = useState<ReservationFilter>('UPCOMING');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [business, setBusiness] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [listing, setListing] = useState<Listing>({ items: [], total: 0, page: 0, loading: true, error: null });
  const sites = useApi<PlayerBusiness[]>('/player/businesses', token);
  const stats = useApi<PlayerStats>('/player/stats', token);

  // Solo cuenta la última petición: un filtro nuevo descarta las respuestas viejas.
  const latest = useRef(0);
  const load = useCallback(
    async (page: number) => {
      const id = ++latest.current;
      setListing((s) => ({ ...s, loading: true, error: null }));
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
      if (business) params.set('business', business);
      if (sport) params.set('sport', sport);
      try {
        const data = await api<PlayerReservationPage>(`/player/reservations?${params}`, { token });
        if (id !== latest.current) return;
        setListing((s) => ({
          items: page === 1 ? data.items : [...s.items, ...data.items],
          total: data.total,
          page,
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (id !== latest.current) return;
        setListing((s) => ({ ...s, loading: false, error: errorMessage(error) }));
      }
    },
    [token, status, business, sport],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const counts: Record<ReservationFilter, number | undefined> = {
    ALL: stats.data?.total,
    UPCOMING: stats.data?.upcoming,
    PLAYED: stats.data?.played,
    CANCELLED: stats.data?.cancelled,
    NO_SHOW: stats.data?.noShow,
  };
  const hasFilters = status !== 'UPCOMING' || business !== '' || sport !== '';
  const { items, total, page, loading, error } = listing;

  return (
    <section aria-label="Mis reservas" className="flex flex-col gap-3">
      <h2 className="text-lg font-bold tracking-tight">Mis reservas</h2>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label="Estado">
        {FILTERS.map(({ value, label }) => {
          const active = status === value;
          const count = counts[value];
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                active
                  ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-accent/25'
                  : 'border-hairline bg-surface text-fg-2 hover:border-fg-3'
              }`}
            >
              {label}
              {count !== undefined && (
                <span className={`tabular rounded-full px-1.5 text-[10px] ${active ? 'bg-black/15' : 'bg-surface-2 text-fg-3'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select label="Sede" value={business} onChange={setBusiness}>
          <option value="">Todas las sedes</option>
          {(sites.data ?? []).map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Deporte" value={sport} onChange={(v) => setSport(v as Sport | '')}>
          <option value="">Todos los deportes</option>
          {(Object.keys(SPORT_LABELS) as Sport[]).map((code) => (
            <option key={code} value={code}>
              {SPORT_EMOJI[code]} {SPORT_LABELS[code]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-fg-3">Agrupar por</span>
        <div role="group" aria-label="Agrupar por" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
          {GROUPS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={groupBy === value}
              onClick={() => setGroupBy(value)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                groupBy === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-3 hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert>
          {error}{' '}
          <button type="button" onClick={() => void load(page || 1)} className="font-semibold underline">
            Reintentar
          </button>
        </Alert>
      )}

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : !error && items.length === 0 ? (
        <Card className="flex flex-col items-start gap-2 shadow-sm">
          <p className="text-sm text-fg-3">
            <span aria-hidden="true">📅 </span>
            {hasFilters ? 'No hay reservas con esos filtros.' : 'Todavía no tienes reservas.'}
          </p>
          {hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus('UPCOMING');
                setBusiness('');
                setSport('');
              }}
            >
              Limpiar filtros
            </Button>
          ) : (
            <Link to="/" className="text-sm font-semibold text-accent-text hover:underline">
              Ver sedes para reservar →
            </Link>
          )}
        </Card>
      ) : (
        <>
          <p className="text-xs font-medium text-fg-3" aria-live="polite">
            Mostrando <b className="font-bold text-fg">{plural(total, 'reserva', 'reservas')}</b>
          </p>
          <div className="flex flex-col gap-5">
            {groupReservations(items, groupBy).map((group) => (
              <section key={group.label} aria-label={group.label || 'Reservas'} className="flex flex-col gap-3">
                {groupBy !== 'none' && (
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-3">
                    {group.label}
                    <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                      {group.items.length}
                    </span>
                  </h3>
                )}
                <ul className="flex flex-col gap-3">
                  {group.items.map((r) => (
                    <li key={r.id}>
                      <ReservationCard reservation={r} business={{ name: r.businessName, slug: r.businessSlug }} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {items.length < total && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={loading} onClick={() => void load(page + 1)}>
                Ver más reservas
              </Button>
            </div>
          )}
        </>
      )}
      <p className="text-center text-xs text-fg-3">Para cancelar o cambiar una reserva, comunícate con la sede.</p>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-hairline bg-surface-2 py-2.5 pl-3.5 pr-9 text-xs font-medium text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" />
    </label>
  );
}
