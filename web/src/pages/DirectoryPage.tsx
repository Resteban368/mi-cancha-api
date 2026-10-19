import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PinIcon,
  PitchBottomNav,
  PitchHeader,
  SearchIcon,
  usePitchTheme,
} from '../components/PitchChrome';
import { Alert, Button, Card, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatMoney, SPORT_EMOJI, SPORT_LABELS } from '../lib/format';
import { useSession } from '../lib/session';
import type {
  DirectoryBusiness,
  DirectoryPage as DirectoryResponse,
  PlayerBusiness,
  PublicAmenity,
  Sport,
} from '../lib/types';
import { useApi } from '../lib/useApi';

const PAGE_SIZE = 12;

interface Origin {
  lat: number;
  lng: number;
}

interface Listing {
  businesses: DirectoryBusiness[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
}

/** Directorio general: todas las sedes que reciben reservas, con búsqueda, filtros y "cerca de mí". */
export function DirectoryPage() {
  usePitchTheme();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [amenity, setAmenity] = useState('');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing>({
    businesses: [],
    total: 0,
    page: 0,
    loading: true,
    error: null,
  });
  const amenities = useApi<PublicAmenity[]>('/public/amenities');
  const { token } = useSession();
  // Sedes donde el jugador ya es cliente (solo si inició sesión).
  const memberships = useApi<PlayerBusiness[]>(token ? '/player/businesses' : null, token);
  const memberSlugs = new Set((memberships.data ?? []).map((m) => m.slug));

  // Espera a que el jugador termine de escribir antes de buscar.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Solo cuenta la última petición: un filtro nuevo descarta las respuestas viejas.
  const latest = useRef(0);
  const load = useCallback(
    async (page: number) => {
      const id = ++latest.current;
      setListing((s) => ({ ...s, loading: true, error: null }));
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (term) params.set('q', term);
      if (sport) params.set('sport', sport);
      if (amenity) params.set('amenity', amenity);
      if (origin) {
        params.set('lat', String(origin.lat));
        params.set('lng', String(origin.lng));
      }
      try {
        const data = await api<DirectoryResponse>(`/public/businesses?${params}`);
        if (id !== latest.current) return;
        setListing((s) => ({
          businesses: page === 1 ? data.businesses : [...s.businesses, ...data.businesses],
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
    [term, sport, amenity, origin],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  /** Solo se pide el permiso de ubicación cuando el jugador toca el botón. */
  function locate() {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no permite usar la ubicación. Puedes seguir buscando sin ella.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationError('No pudimos usar tu ubicación. Revisa el permiso del navegador o sigue buscando sin ella.');
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  const hasFilters = Boolean(term || sport || amenity);
  const { businesses, total, page, loading, error } = listing;

  function clearFilters() {
    setSearch('');
    setTerm('');
    setSport('');
    setAmenity('');
  }

  return (
    <>
      <PitchHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-28 pt-5 sm:pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reserva tu cancha</h1>
          <p className="mt-1 text-sm text-fg-3">
            Elige una sede para consultar disponibilidad y horarios en tiempo real.
          </p>
        </div>

        <section className="flex flex-col gap-3" aria-label="Buscar y filtrar">
          <label className="relative block">
            <span className="sr-only">Buscar por nombre, barrio o dirección</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-fg-3" />
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, barrio o dirección"
              className={`${controlClass} py-3 pl-11 pr-11`}
            />
            {search && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-3 transition hover:text-fg"
              >
                <CloseIcon className="size-4" />
              </button>
            )}
          </label>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label="Deporte">
            <Chip pressed={!sport} onClick={() => setSport('')}>
              Todos
            </Chip>
            {(Object.keys(SPORT_LABELS) as Sport[]).map((code) => (
              <Chip key={code} pressed={sport === code} onClick={() => setSport(code)}>
                <span aria-hidden>{SPORT_EMOJI[code]}</span> {SPORT_LABELS[code]}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-2">
            <label className="relative col-span-7 sm:col-span-5">
              <span className="sr-only">Servicio</span>
              <select
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
                className={`${controlClass} appearance-none py-2.5 pl-3.5 pr-9 text-xs font-medium`}
              >
                <option value="">Todos los servicios</option>
                {(amenities.data ?? []).map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" />
            </label>
            <button
              type="button"
              onClick={origin ? () => setOrigin(null) : locate}
              disabled={locating}
              aria-pressed={Boolean(origin)}
              className={
                'col-span-5 flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition active:scale-95 disabled:opacity-60 sm:col-span-3 ' +
                (origin
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-emerald-500/30 bg-surface text-accent hover:bg-white/5')
              }
            >
              {locating ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : (
                <PinIcon className="size-4" />
              )}
              {origin ? 'Quitar cercanía' : 'Cerca de mí'}
            </button>
          </div>

          {locationError && <Alert tone="warn">{locationError}</Alert>}
        </section>

        {error && (
          <Alert>
            {error}{' '}
            <button type="button" onClick={() => load(page || 1)} className="font-semibold underline">
              Reintentar
            </button>
          </Alert>
        )}

        {loading && businesses.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : !error && businesses.length === 0 ? (
          <Card>
            <p className="font-semibold">No encontramos sedes con esos filtros.</p>
            {hasFilters && (
              <Button variant="secondary" className="mt-3" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </Card>
        ) : (
          <>
            <p className="text-xs font-medium text-fg-3" aria-live="polite">
              Mostrando{' '}
              <b className="font-bold text-fg">
                {total} {total === 1 ? 'sede' : 'sedes'}
              </b>
              {origin ? ' · ordenadas por cercanía' : ''}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((business) => (
                <li key={business.slug}>
                  <BusinessCard business={business} member={memberSlugs.has(business.slug)} />
                </li>
              ))}
            </ul>
            {businesses.length < total && (
              <div className="flex justify-center">
                <Button variant="secondary" loading={loading} onClick={() => load(page + 1)}>
                  Ver más sedes
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <PitchBottomNav />
    </>
  );
}

/** Campo de texto o lista con el estilo del diseño. */
const controlClass =
  'w-full rounded-2xl border border-white/10 bg-surface-2 text-sm text-fg placeholder:text-fg-3 shadow-inner ' +
  'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition active:scale-95 ' +
        (pressed
          ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-emerald-500/25'
          : 'border-white/10 bg-surface text-fg-2 hover:border-slate-500')
      }
    >
      {children}
    </button>
  );
}

function BusinessCard({ business, member }: { business: DirectoryBusiness; member: boolean }) {
  const { name, slug, neighborhood, address, imageUrl, sports, courtCount, amenities, fromPricePerHour, currency, distanceKm } =
    business;
  const shownSports = sports.slice(0, 2);
  const extraSports = sports.length - shownSports.length;
  const shownAmenities = amenities.slice(0, 3);
  const extraAmenities = amenities.length - shownAmenities.length;
  const courts = `${courtCount} ${courtCount === 1 ? 'cancha' : 'canchas'}`;

  return (
    <Link
      to={`/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg transition active:scale-[0.99] hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative h-44 w-full overflow-hidden bg-surface-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-5xl" aria-hidden>
            {sports[0] ? SPORT_EMOJI[sports[0]] : '🏟️'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/10 to-transparent" />

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          {member ? (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
              Ya eres cliente
            </span>
          ) : (
            courtCount > 1 && (
              <span className="rounded-full bg-blue-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
                Canchas múltiples
              </span>
            )
          )}
        </div>
        {shownSports.length > 0 && (
          <div className="absolute right-3 top-3 flex items-center gap-1">
            {shownSports.map((code) => (
              <span
                key={code}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md"
              >
                <span aria-hidden>{SPORT_EMOJI[code]}</span> {SPORT_LABELS[code]}
              </span>
            ))}
            {extraSports > 0 && (
              <span className="rounded-full border border-white/10 bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-md">
                +{extraSports}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-base font-bold tracking-tight">{name}</h2>
            {distanceKm !== null && (
              <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-accent">
                {formatDistance(distanceKm)}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-3">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {neighborhood} · {address}
            </span>
          </p>
        </div>

        {shownAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shownAmenities.map((a) => (
              <span
                key={a.code}
                className="rounded-md border border-white/5 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-fg-2"
              >
                {a.name}
              </span>
            ))}
            {extraAmenities > 0 && <span className="px-1 py-0.5 text-[11px] text-fg-3">+{extraAmenities}</span>}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <div className="min-w-0">
            <p className="text-[11px] text-fg-3">{courts}</p>
            {fromPricePerHour !== null ? (
              <p className="text-sm font-extrabold">
                Desde <span className="tabular text-accent">{formatMoney(fromPricePerHour, currency)}</span>{' '}
                <span className="text-xs font-normal text-fg-3">/ h</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-fg-2">Consulta precios</p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-xs font-bold tracking-wide text-accent-fg shadow-md shadow-emerald-500/20 transition group-hover:brightness-110">
            Ver turnos
            <ChevronRightIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}
