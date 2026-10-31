import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AmenityIcon,
  ArrowForwardIcon,
  ChevronDownIcon,
  CloseIcon,
  HeartIcon,
  LoyaltyIcon,
  PinIcon,
  PitchBottomNav,
  PitchHeader,
  SearchIcon,
  TuneIcon,
  VerifiedIcon,
} from '../components/PitchChrome';
import { Alert, Button, Card, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatMoney, SPORT_EMOJI, SPORT_LABELS } from '../lib/format';
import { cityPromptSkipped, readCity, saveCity, skipCityPrompt, type SavedCity } from '../lib/location';
import { useSession } from '../lib/session';
import type {
  DirectoryBusiness,
  DirectoryPage as DirectoryResponse,
  PlayerBusiness,
  PublicAmenity,
  Sport,
} from '../lib/types';
import { useApi } from '../lib/useApi';

// El selector de ciudades se descarga solo cuando se abre.
const CityDialog = lazy(() => import('../components/CityDialog'));

const PAGE_SIZE = 12;

interface Listing {
  businesses: DirectoryBusiness[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
}

const FAVORITES_KEY = 'mi-cancha-favorites';

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
  } catch {}
}

/** Directorio general de sedes con buscador interactivo, chips de deportes, filtros y tarjetas enriquecidas. */
export function DirectoryPage() {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [sport, setSport] = useState<Sport | ''>('');
  const [amenity, setAmenity] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [city, setCity] = useState<SavedCity | null>(readCity);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(readFavorites);
  const cityId = city?.cityId ?? null;
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
  const memberSlugs = useMemo(() => new Set((memberships.data ?? []).map((m) => m.slug)), [memberships.data]);

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
      if (cityId) params.set('cityId', cityId);
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
    [term, sport, amenity, cityId],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // Con sesión iniciada, la primera vez que entra a Explorar se le pregunta en qué ciudad busca.
  useEffect(() => {
    if (token && !readCity() && !cityPromptSkipped()) setDialogOpen(true);
  }, [token]);

  function chooseCity(next: SavedCity) {
    saveCity(next);
    setCity(next);
    setDialogOpen(false);
  }

  function closeDialog() {
    if (!city) skipCityPrompt();
    setDialogOpen(false);
  }

  function toggleFavorite(slug: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      saveFavorites(next);
      return next;
    });
  }

  const hasFilters = Boolean(term || sport || amenity || onlyFavorites);
  const { businesses, total, page, loading, error } = listing;

  const displayedBusinesses = useMemo(() => {
    if (!onlyFavorites) return businesses;
    return businesses.filter((b) => favorites.has(b.slug));
  }, [businesses, onlyFavorites, favorites]);

  function clearFilters() {
    setSearch('');
    setTerm('');
    setSport('');
    setAmenity('');
    setOnlyFavorites(false);
  }

  // Contadores por deporte en los resultados actuales
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of businesses) {
      for (const s of b.sports) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return counts;
  }, [businesses]);

  return (
    <>
      <PitchHeader cityLabel={city?.label ?? 'Todas las ciudades'} onCityClick={() => setDialogOpen(true)} />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-28 pt-4 sm:pb-14">
        {/* Cabecera Hero */}
        <section className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-bold tracking-wide text-accent-text uppercase shadow-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
            Turnos en vivo · Hoy
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            Reserva tu cancha
          </h1>
          <p className="text-xs text-fg-3 sm:text-sm">
            Elige una sede para consultar disponibilidad y horarios en tiempo real
            {city?.label ? ` en ${city.label}.` : '.'}
          </p>
        </section>

        {/* Barra de Búsqueda y Filtros */}
        <section className="flex flex-col gap-3" aria-label="Buscar y filtrar sedes">
          <div className="relative group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-fg-3 group-focus-within:text-accent-text transition-colors">
              <SearchIcon className="size-5" />
            </div>
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por sede, barrio o deporte..."
              className="w-full rounded-2xl border border-hairline bg-surface-2 py-3 pl-11 pr-24 text-sm text-fg placeholder:text-fg-3 shadow-inner transition-all focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search ? (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setSearch('')}
                className="absolute right-12 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-3 transition hover:text-fg"
              >
                <CloseIcon className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('amenities-select');
                if (el) el.focus();
              }}
              className="absolute inset-y-1.5 right-1.5 flex items-center gap-1 rounded-xl border border-hairline bg-surface px-2.5 text-xs font-semibold text-fg-2 shadow-sm transition hover:bg-surface-2 active:scale-95"
            >
              <TuneIcon className="size-3.5 text-accent-text" />
              <span>Filtros</span>
            </button>
          </div>

          {/* Carrusel de Disciplinas Deportivas y Favoritas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5 text-xs font-semibold text-fg-3">
              <span>Disciplinas deportivas</span>
              {(sport || onlyFavorites) && (
                <button
                  type="button"
                  onClick={() => {
                    setSport('');
                    setOnlyFavorites(false);
                  }}
                  className="font-bold text-accent-text transition hover:underline"
                >
                  Ver todas
                </button>
              )}
            </div>
            <div
              className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1"
              role="group"
              aria-label="Deporte y filtros rápidos"
            >
              <button
                type="button"
                aria-pressed={!sport && !onlyFavorites}
                onClick={() => {
                  setSport('');
                  setOnlyFavorites(false);
                }}
                className={
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 ' +
                  (!sport && !onlyFavorites
                    ? 'bg-accent text-accent-fg shadow-glow-accent'
                    : 'border border-hairline bg-surface text-fg-2 hover:border-fg-3')
                }
              >
                <span>Todos</span>
              </button>

              {/* Botón Filtro Favoritas */}
              <button
                type="button"
                aria-pressed={onlyFavorites}
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={
                  'flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ' +
                  (onlyFavorites
                    ? 'border-rose-500 bg-rose-500/15 text-rose-500 font-bold shadow-sm'
                    : 'border-hairline bg-surface text-fg-2 hover:border-rose-400/40')
                }
              >
                <HeartIcon filled={onlyFavorites} className={`size-3.5 ${onlyFavorites ? 'text-rose-500' : 'text-fg-3'}`} />
                <span>Favoritas</span>
                {favorites.size > 0 && (
                  <span
                    className={
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold ' +
                      (onlyFavorites ? 'bg-rose-500 text-white' : 'bg-surface-2 text-fg-3')
                    }
                  >
                    {favorites.size}
                  </span>
                )}
              </button>

              {(Object.keys(SPORT_LABELS) as Sport[]).map((code) => {
                const isSelected = sport === code && !onlyFavorites;
                const count = sportCounts[code];
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSport(code);
                      setOnlyFavorites(false);
                    }}
                    className={
                      'flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ' +
                      (isSelected
                        ? 'border-accent bg-accent text-accent-fg shadow-glow-accent font-bold'
                        : 'border-hairline bg-surface text-fg-2 hover:border-accent/40')
                    }
                  >
                    <span aria-hidden className="text-sm">
                      {SPORT_EMOJI[code]}
                    </span>
                    <span>{SPORT_LABELS[code]}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        className={
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold ' +
                          (isSelected
                            ? 'bg-accent-fg/20 text-accent-fg'
                            : 'bg-surface-2 text-fg-3')
                        }
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros secundarios: Servicios y Ciudad */}
          <div className="grid grid-cols-2 gap-2.5">
            <label className="relative block">
              <span className="sr-only">Servicio o amenidad</span>
              <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-xs font-semibold text-fg-2 shadow-sm transition hover:border-accent/40">
                <div className="flex min-w-0 items-center gap-1.5 truncate">
                  <TuneIcon className="size-3.5 shrink-0 text-accent" />
                  <span className="truncate">
                    {amenity
                      ? amenities.data?.find((a) => a.code === amenity)?.name ?? 'Servicio'
                      : 'Todos los servicios'}
                  </span>
                </div>
                <ChevronDownIcon className="size-3.5 shrink-0 text-fg-3" />
              </div>
              <select
                id="amenities-select"
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">Todos los servicios</option>
                {(amenities.data ?? []).map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              aria-pressed={Boolean(cityId)}
              className={
                'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition active:scale-95 shadow-sm ' +
                (cityId
                  ? 'border-accent/40 bg-accent/15 text-accent-text hover:bg-accent/25'
                  : 'border-hairline bg-surface text-fg-2 hover:border-accent/40')
              }
            >
              <div className="flex min-w-0 items-center gap-1.5 truncate">
                <PinIcon className="size-3.5 shrink-0 text-accent" />
                <span className="truncate">{city?.label ?? 'Elegir ciudad'}</span>
              </div>
              <ChevronDownIcon className="size-3.5 shrink-0 text-fg-3" />
            </button>
          </div>
        </section>

        {/* Estado y Resultados */}
        {error && (
          <Alert>
            {error}{' '}
            <button type="button" onClick={() => load(page || 1)} className="font-semibold underline">
              Reintentar
            </button>
          </Alert>
        )}

        <div className="flex items-center justify-between px-0.5 text-xs text-fg-3">
          <div>
            Mostrando{' '}
            <strong className="font-extrabold text-fg">
              {displayedBusinesses.length}{' '}
              {displayedBusinesses.length === 1 ? 'sede activa' : 'sedes activas'}
            </strong>
            {onlyFavorites && ' (favoritas)'}
            {cityId && city ? ` en ${city.label}` : ''}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-accent-text">
            <span className="size-2 rounded-full bg-accent" />
            <span>Disponibilidad inmediata</span>
          </div>
        </div>

        {/* Lista de Sedes */}
        {loading && businesses.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !error && displayedBusinesses.length === 0 ? (
          onlyFavorites ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-2xl mb-3 text-rose-500 shadow-inner">
                <HeartIcon filled className="size-7 text-rose-500" />
              </div>
              <p className="text-base font-bold text-fg">No tienes sedes favoritas guardadas.</p>
              <p className="mt-1 text-xs text-fg-3 max-w-xs">
                Toca el corazón en cualquier sede para agregarla a tus favoritas y encontrarla fácilmente aquí.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => setOnlyFavorites(false)}>
                Ver todas las sedes
              </Button>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl mb-3 shadow-inner">
                🔍
              </div>
              <p className="text-base font-bold text-fg">No encontramos sedes con esos filtros.</p>
              <p className="mt-1 text-xs text-fg-3 max-w-xs">
                Prueba cambiando la disciplina deportiva, el servicio o la ciudad seleccionada.
              </p>
              {hasFilters && (
                <Button variant="secondary" className="mt-4" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </Card>
          )
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedBusinesses.map((business) => (
                <li key={business.slug}>
                  <BusinessCard
                    business={business}
                    member={memberSlugs.has(business.slug)}
                    favorite={favorites.has(business.slug)}
                    onToggleFavorite={() => toggleFavorite(business.slug)}
                  />
                </li>
              ))}
            </ul>
            {!onlyFavorites && businesses.length < total && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" loading={loading} onClick={() => load(page + 1)}>
                  Ver más sedes
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <PitchBottomNav />
      {dialogOpen && (
        <Suspense fallback={null}>
          <CityDialog current={city} onSelect={chooseCity} onClose={closeDialog} />
        </Suspense>
      )}
    </>
  );
}

/** Tarjeta enriquecida de sede con soporte de favoritos, amenidades y beneficios de fidelidad. */
function BusinessCard({
  business,
  member,
  favorite,
  onToggleFavorite,
}: {
  business: DirectoryBusiness;
  member: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const {
    name,
    slug,
    neighborhood,
    address,
    imageUrl,
    sports,
    courtCount,
    amenities,
    fromPricePerHour,
    currency,
    city,
    distanceKm,
  } = business;

  const shownSports = sports.slice(0, 2);
  const shownAmenities = amenities.slice(0, 3);
  const extraAmenities = amenities.length - shownAmenities.length;
  const courtsLabel = `${courtCount} ${courtCount === 1 ? 'cancha disponible' : 'canchas disponibles'}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-md dark:shadow-none transition-all hover:border-accent/50 hover:shadow-lg">
      <Link to={`/${slug}`} className="block focus-visible:outline-2 focus-visible:outline-accent">
        {/* Encabezado con Imagen */}
        <div className="relative h-44 w-full overflow-hidden bg-surface-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-surface-2 text-5xl" aria-hidden>
              {sports[0] ? SPORT_EMOJI[sports[0]] : '🏟️'}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/30 to-transparent" />

          {/* Badges superiores */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {member ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold text-accent-fg shadow-lg">
                  <VerifiedIcon className="size-3.5" />
                  <span>Ya eres cliente</span>
                </span>
              ) : courtCount > 1 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                  <span>Canchas múltiples</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
                  <VerifiedIcon className="size-3 text-accent" />
                  <span>Sede verificada</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md border border-white/20">
                ⚡ Reserva rápida
              </span>
            </div>

            {/* Botón Favorito */}
            <button
              type="button"
              aria-label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              aria-pressed={favorite}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={
                'flex size-8 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-90 ' +
                (favorite
                  ? 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-105'
                  : 'border-white/20 bg-black/50 text-white hover:text-rose-400 hover:bg-black/70 hover:scale-105')
              }
            >
              <HeartIcon filled={favorite} className="size-4" />
            </button>
          </div>

          {/* Chips de Deportes sobre la imagen */}
          {shownSports.length > 0 && (
            <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
              {shownSports.map((code) => (
                <span
                  key={code}
                  className="flex items-center gap-1 rounded-lg border border-hairline/60 bg-bg/85 px-2 py-0.5 text-[11px] font-medium text-fg backdrop-blur-md"
                >
                  <span aria-hidden>{SPORT_EMOJI[code]}</span>
                  <span>{SPORT_LABELS[code]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Contenido de la Tarjeta */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Título y Ubicación */}
        <Link to={`/${slug}`} className="min-w-0">
          <h2 className="font-display text-base font-bold text-fg leading-snug group-hover:text-accent-text transition-colors line-clamp-1">
            {name}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-3">
            <PinIcon className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">
              {city ? `${city.name} · ` : ''}
              {neighborhood} · {address}
              {distanceKm !== null && distanceKm !== undefined && (
                <span className="font-semibold text-accent-text"> ({distanceKm.toFixed(1)} km)</span>
              )}
            </span>
          </p>
        </Link>

        {/* Banner de Fidelización / Beneficio */}
        <div className="flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[11px] font-bold text-accent-text shadow-sm">
          <LoyaltyIcon className="size-3.5 shrink-0 text-accent" />
          <span className="truncate">
            {member
              ? 'Sellos activos: ¡Acumula partidos y gana turnos gratis!'
              : 'Beneficio Mi Cancha: Reserva online sin costo adicional'}
          </span>
          <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-accent-fg">
            {member ? 'Sellos' : 'Directo'}
          </span>
        </div>

        {/* Amenidades */}
        {shownAmenities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-2">
            {shownAmenities.map((a) => (
              <span
                key={a.code}
                className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2 py-0.5"
              >
                <AmenityIcon code={a.code} className="size-3 text-accent" />
                <span>{a.name}</span>
              </span>
            ))}
            {extraAmenities > 0 && (
              <span className="rounded-lg border border-hairline bg-surface-2 px-1.5 py-0.5 font-bold text-fg-3">
                +{extraAmenities}
              </span>
            )}
          </div>
        )}

        {/* Footer con Precio y Botón CTA */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold text-fg-3">{courtsLabel}</span>
            {fromPricePerHour !== null ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-fg-3">Desde</span>
                <span className="font-display text-base font-extrabold text-fg tabular">
                  {formatMoney(fromPricePerHour, currency)}
                </span>
                <span className="text-[10px] text-fg-3">/ h</span>
              </div>
            ) : (
              <p className="text-xs font-semibold text-fg-2">Consulta horarios</p>
            )}
          </div>
          <Link
            to={`/${slug}`}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-fg shadow-glow-accent transition hover:brightness-110 active:scale-95"
          >
            <span>Ver turnos</span>
            <ArrowForwardIcon className="size-3.5 stroke-[2.5]" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Skeleton de carga que replica exactamente el diseño de la tarjeta de sede */
function SkeletonCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-sm">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-3/4 rounded-lg" />
          <Skeleton className="h-3.5 w-1/2 rounded-md" />
        </div>
        <Skeleton className="h-7 w-full rounded-xl" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
