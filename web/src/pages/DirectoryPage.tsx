import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Button, Card, inputClass, Skeleton } from '../components/ui';
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
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Reserva tu cancha</h1>
          <p className="mt-1 text-sm text-fg-2">Elige una sede para ver sus canchas y horarios.</p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="sr-only">Buscar por nombre, barrio o dirección</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, barrio o dirección"
              className={inputClass}
            />
          </label>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Deporte">
            <Chip pressed={!sport} onClick={() => setSport('')}>
              Todos
            </Chip>
            {(Object.keys(SPORT_LABELS) as Sport[]).map((code) => (
              <Chip key={code} pressed={sport === code} onClick={() => setSport(code)}>
                {SPORT_EMOJI[code]} {SPORT_LABELS[code]}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Servicio</span>
              <select value={amenity} onChange={(e) => setAmenity(e.target.value)} className={inputClass}>
                <option value="">Todos los servicios</option>
                {(amenities.data ?? []).map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {origin ? (
              <Button variant="secondary" onClick={() => setOrigin(null)}>
                Quitar "cerca de mí"
              </Button>
            ) : (
              <Button variant="secondary" onClick={locate} loading={locating}>
                📍 Cerca de mí
              </Button>
            )}
          </div>

          {locationError && <Alert tone="warn">{locationError}</Alert>}
        </div>

        {error && (
          <Alert>
            {error}{' '}
            <button type="button" onClick={() => load(page || 1)} className="font-semibold underline">
              Reintentar
            </button>
          </Alert>
        )}

        {loading && businesses.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-fg-2" aria-live="polite">
                {total} {total === 1 ? 'sede' : 'sedes'}
                {origin ? ', ordenadas por cercanía' : ''}
              </p>
              {memberSlugs.size > 0 && (
                <Link to="/mis-sedes" className="font-semibold text-accent hover:underline">
                  Mis sedes ({memberSlugs.size})
                </Link>
              )}
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
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
    </>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        'shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ' +
        (pressed ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-fg-2 hover:bg-surface-2')
      }
    >
      {children}
    </button>
  );
}

function BusinessCard({ business, member }: { business: DirectoryBusiness; member: boolean }) {
  const { name, slug, neighborhood, address, imageUrl, sports, courtCount, amenities, fromPricePerHour, currency, distanceKm } =
    business;
  const shownAmenities = amenities.slice(0, 3);
  const extraAmenities = amenities.length - shownAmenities.length;

  return (
    <Link
      to={`/${slug}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-surface-2 text-4xl" aria-hidden>
          {sports[0] ? SPORT_EMOJI[sports[0]] : '🏟️'}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          {member && (
            <span className="mb-1 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              Ya eres cliente
            </span>
          )}
          <h2 className="truncate text-lg font-bold">{name}</h2>
          <p className="truncate text-sm text-fg-2">
            {neighborhood} · {address}
          </p>
          {distanceKm !== null && <p className="mt-1 text-sm font-medium text-accent">{formatDistance(distanceKm)}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {sports.map((code) => (
            <span key={code} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-2">
              {SPORT_EMOJI[code]} {SPORT_LABELS[code]}
            </span>
          ))}
        </div>

        {shownAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs text-fg-3">
            {shownAmenities.map((a) => (
              <span key={a.code} className="rounded-md border border-border px-2 py-0.5">
                {a.name}
              </span>
            ))}
            {extraAmenities > 0 && <span className="px-1 py-0.5">+{extraAmenities}</span>}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3 text-sm">
          <span className="text-fg-2">
            {courtCount} {courtCount === 1 ? 'cancha' : 'canchas'}
          </span>
          {fromPricePerHour !== null && (
            <span className="font-semibold">Desde {formatMoney(fromPricePerHour, currency)}/h</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `A ${Math.round(km * 1000)} m`;
  return `A ${km.toFixed(1).replace('.', ',')} km`;
}
