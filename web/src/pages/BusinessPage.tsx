import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CourtDetails } from '../components/CourtDetails';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { ShimmerImage } from '../components/ShimmerImage';
import { BusinessHeader, ChevronRightIcon, CloseIcon, PinIcon } from '../components/PitchChrome';
import { Alert, Button, Card, Dialog, inputClass, Skeleton } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { accountPath } from '../lib/next';
import {
  courtSpecs,
  bogotaDate,
  bogotaDateOf,
  dayParts,
  formatCountdown,
  dayPeriod,
  type DayPeriod,
  formatLongDay,
  formatMoney,
  formatTime,
  rateAt,
  SPORT_EMOJI,
  SPORT_LABELS,
} from '../lib/format';
import { useSession } from '../lib/session';
import type {
  CourtSlots,
  PublicBusiness,
  PublicCourt,
  Reservation,
  Slot,
  SlotHold,
  Sport,
  SportAvailability,
} from '../lib/types';
import { useApi } from '../lib/useApi';

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  DISABLED: 'Esta sede no tiene activas las reservas en línea por ahora.',
  PLAN_INACTIVE: 'Esta sede no está recibiendo reservas en línea en este momento.',
  NO_COURTS: 'Esta sede aún no tiene canchas disponibles para reservar en línea.',
};

/** Turnos elegidos: 1 a 3 canchas en la misma franja (la primera es la que se tocó). */
const PERIODS: { id: DayPeriod | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'day', label: 'Día' },
  { id: 'afternoon', label: 'Tarde' },
  { id: 'night', label: 'Noche' },
];

interface Selection {
  courtIds: string[];
  start: string;
  slots: number;
}

/** Reserva pendiente mientras el jugador inicia sesión o se registra. */
interface Pending extends Selection {
  sport: Sport;
  date: string;
  notes: string;
}

const pendingKey = (slug: string) => `mi-cancha-pending:${slug}`;

export function savePending(slug: string, pending: Pending) {
  try {
    sessionStorage.setItem(pendingKey(slug), JSON.stringify(pending));
  } catch {
    // Sin almacenamiento solo se pierde la selección.
  }
}

function takePending(slug: string): Pending | null {
  try {
    const raw = sessionStorage.getItem(pendingKey(slug));
    sessionStorage.removeItem(pendingKey(slug));
    if (!raw) return null;
    // Selecciones guardadas antes de poder elegir varias canchas traían courtId.
    const pending = JSON.parse(raw) as Pending & { courtId?: string };
    if (!pending.courtIds && pending.courtId) pending.courtIds = [pending.courtId];
    return pending.courtIds?.length ? pending : null;
  } catch {
    return null;
  }
}

export function BusinessPage() {
  const { slug = '' } = useParams();
  const business = useApi<PublicBusiness>(`/public/businesses/${slug}`);
  const [info, setInfo] = useState(false);

  return (
    <>
      <BusinessHeader
        slug={slug}
        name={business.data?.name}
        address={business.data?.address}
        onInfo={business.data ? () => setInfo(true) : undefined}
      />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-44 pt-4">
        {business.error ? (
          <>
            <Alert>{business.error}</Alert>
            <Link to="/" className="text-sm font-medium text-accent hover:underline">
              ← Todas las sedes
            </Link>
          </>
        ) : !business.data ? (
          <>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </>
        ) : business.data.bookingAvailable ? (
          <Booking business={business.data} />
        ) : (
          <Alert tone="warn">{UNAVAILABLE_MESSAGES[business.data.unavailableReason ?? 'DISABLED']}</Alert>
        )}
      </main>
      {business.data && <VenueInfoDialog business={business.data} open={info} onClose={() => setInfo(false)} />}
    </>
  );
}

/** Fotos de la sede (hasta 5): la grande se amplía con zoom y las miniaturas la cambian. */
function VenuePhotos({ business: b }: { business: PublicBusiness }) {
  const photos = b.photos?.length ? b.photos : b.imageUrl ? [b.imageUrl] : [];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = photos[Math.min(index, photos.length - 1)];

  if (!current) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-surface-2 text-5xl" aria-hidden="true">
        🏟️
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="Ampliar foto de la sede"
        className="block w-full cursor-zoom-in rounded-2xl"
      >
        <ShimmerImage
          key={current}
          src={current}
          alt={`Sede ${b.name}`}
          wrapperClassName="aspect-video w-full rounded-2xl border border-border"
          className="object-cover"
        />
      </button>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Fotos de la sede">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Ver foto ${i + 1} de ${photos.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={`aspect-video w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === index ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <ShimmerImage src={url} alt="" wrapperClassName="size-full" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <PhotoLightbox
          photos={photos.map((url, i) => ({ url, label: `${b.name}: foto ${i + 1}` }))}
          index={Math.min(index, photos.length - 1)}
          onIndexChange={setIndex}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}

/** Hoja con la información de la sede: foto, ubicación, descripción y servicios. */
function VenueInfoDialog({ business: b, open, onClose }: { business: PublicBusiness; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="venue-info-title">
      <div className="-mt-1 mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-fg-3">Información de la sede</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-fg-2 transition hover:text-fg"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <VenuePhotos business={b} />
        <div>
          <h2 id="venue-info-title" className="text-lg font-bold">
            {b.name}
          </h2>
          <p className="mt-0.5 text-xs text-fg-3">
            {b.address} · {b.neighborhood}
          </p>
          <a
            href={b.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-accent transition hover:brightness-125"
          >
            <PinIcon className="size-3.5 text-rose-400" />
            Ver ubicación en Google Maps
          </a>
        </div>
        {b.description && (
          <p className="border-t border-border pt-3 text-sm leading-relaxed text-fg-2">{b.description}</p>
        )}
        {b.amenities.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-3">Servicios e instalaciones</h3>
            <ul className="flex flex-wrap gap-2">
              {b.amenities.map((a) => (
                <li key={a.code} className="rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-fg-2">
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-surface-2 py-3 text-xs font-semibold transition hover:brightness-125"
        >
          Cerrar
        </button>
      </div>
    </Dialog>
  );
}

/** Cada cuánto se refrescan los turnos mientras la página está visible. */
const POLL_MS = 5_000;

function Booking({ business }: { business: PublicBusiness }) {
  const { token, signOut } = useSession();
  const navigate = useNavigate();
  const [restored] = useState(() => (token ? takePending(business.slug) : null));
  const [sport, setSport] = useState<Sport>(restored?.sport ?? business.sports[0]);
  const [date, setDate] = useState(restored?.date ?? bogotaDate());
  const [selection, setSelection] = useState<Selection | null>(restored);
  const [notes, setNotes] = useState(restored?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [booked, setBooked] = useState<Reservation | null>(null);
  const [details, setDetails] = useState<PublicCourt | null>(null);
  const [period, setPeriod] = useState<DayPeriod | 'all'>('all');
  // Apartado propio; expiresAt en el reloj del navegador.
  const [hold, setHold] = useState<{ value: SlotHold; expiresAt: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const holdSeq = useRef(0);
  const holdPath = `/player/businesses/${business.slug}/hold`;

  const availability = useApi<SportAvailability>(
    `/public/businesses/${business.slug}/availability?date=${date}&sport=${sport}`,
  );
  const { reload } = availability;
  const dates = Array.from({ length: business.rules.maxDaysAhead + 1 }, (_, i) => bogotaDate(i));

  // Turnos "en vivo": se refrescan solos mientras la pestaña está visible.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && reload();
    const id = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload]);

  /** Del apartado propio: el turno se ve libre para quien lo apartó. */
  const isMine = (courtId: string, slot: Slot) =>
    hold !== null &&
    hold.value.courtIds.includes(courtId) &&
    Date.parse(slot.start) >= Date.parse(hold.value.start) &&
    Date.parse(slot.end) <= Date.parse(hold.value.end);
  const isFree = (courtId: string, slot: Slot) =>
    slot.status === 'AVAILABLE' ||
    (slot.status === 'HELD' && (isMine(courtId, slot) || (holding && Boolean(selection?.courtIds.includes(courtId)))));

  const maxCourts = business.rules.maxCourts ?? 1;
  const courtsData = availability.data?.courts ?? [];
  /** Dónde empieza la franja elegida en una cancha y cuántos turnos seguidos libres tiene. */
  const freeRun = (c: CourtSlots | undefined) => {
    const index = c && selection ? c.slots.findIndex((s) => s.start === selection.start) : -1;
    let count = 0;
    if (c && index !== -1) {
      while (count < business.rules.maxSlots && c.slots[index + count] && isFree(c.court.id, c.slots[index + count])) {
        count++;
      }
    }
    return { index, count };
  };
  const runs = (selection?.courtIds ?? []).map((id) => {
    const c = courtsData.find((x) => x.court.id === id);
    return { id, court: c, ...freeRun(c) };
  });
  const court = runs[0]?.court;
  // La duración es la misma en todas: la que quepa en todas las canchas elegidas.
  const maxCount = runs.length ? Math.min(...runs.map((r) => r.count)) : 0;
  const count = selection ? Math.min(selection.slots, maxCount) : 0;
  const chosenByCourt = runs.map((r) => ({
    court: r.court,
    slots: r.court && r.index !== -1 ? r.court.slots.slice(r.index, r.index + count) : [],
  }));
  const chosen = chosenByCourt[0]?.slots ?? [];
  const total = chosenByCourt.reduce((sum, c) => sum + c.slots.reduce((s, x) => s + x.price, 0), 0);
  // Otras canchas del deporte libres en la misma franja, con el mismo turno.
  const addable =
    selection && court && selection.courtIds.length < maxCourts
      ? courtsData.filter(
          (c) =>
            !selection.courtIds.includes(c.court.id) &&
            c.court.slotDuration === court.court.slotDuration &&
            freeRun(c).count >= count,
        )
      : [];
  const remaining = hold ? (hold.expiresAt - now) / 1000 : 0;
  const lostKey = availability.data
    ? runs
        .filter((r) => r.count === 0)
        .map((r) => r.id)
        .join(',')
    : '';

  // Si otra persona tomó alguna cancha elegida, se quita (y si eran todas, se descarta la selección).
  useEffect(() => {
    if (!selection || holding || !lostKey) return;
    const lost = lostKey.split(',');
    const keep = selection.courtIds.filter((id) => !lost.includes(id));
    if (!keep.length) {
      setSelection(null);
      setHold(null);
      setNotice('Ese turno lo acaba de tomar otra persona. Elige otro horario.');
      return;
    }
    const names = lost.map((id) => courtsData.find((c) => c.court.id === id)?.court.name ?? 'Una cancha');
    const next = { ...selection, courtIds: keep };
    setSelection(next);
    setNotice(`${names.join(' y ')} ya no está libre en ese horario y se quitó de tu reserva.`);
    void requestHold(next);
    // Solo cuando cambia qué canchas se perdieron.
  }, [lostKey, holding]);

  // Cuenta regresiva del apartado; al vencer, el turno queda libre otra vez.
  useEffect(() => {
    if (!hold) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [hold]);
  useEffect(() => {
    if (hold && remaining <= 0) {
      holdSeq.current++;
      setHold(null);
      setSelection(null);
      setNotice('Se acabó el tiempo y el turno quedó libre otra vez. Elígelo de nuevo si aún lo quieres.');
      reload();
    }
  }, [hold, remaining, reload]);

  // Al cerrar la página se suelta el apartado (si no, vence solo).
  useEffect(() => {
    if (!hold || !token) return;
    const release = () => void api(holdPath, { method: 'DELETE', token, keepalive: true }).catch(() => undefined);
    window.addEventListener('pagehide', release);
    return () => window.removeEventListener('pagehide', release);
  }, [hold, token, holdPath]);

  function goToLogin(pending: Selection) {
    savePending(business.slug, { ...pending, sport, date, notes });
    navigate(accountPath('ingresar', `/${business.slug}`));
  }

  /** Aparta los turnos elegidos (reemplaza el apartado anterior). */
  async function requestHold(next: Selection) {
    if (!token) return;
    const seq = ++holdSeq.current;
    setHolding(true);
    try {
      const value = await api<SlotHold>(holdPath, { method: 'PUT', token, body: next });
      if (seq !== holdSeq.current) return;
      setHold({ value, expiresAt: Date.now() + business.rules.holdMinutes * 60_000 });
      setNow(Date.now());
    } catch (e) {
      if (seq !== holdSeq.current) return;
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        goToLogin(next);
        return;
      }
      setHold(null);
      setSelection(null);
      setNotice(errorMessage(e));
      reload();
    } finally {
      if (seq === holdSeq.current) setHolding(false);
    }
  }

  function releaseHold() {
    holdSeq.current++;
    setHolding(false);
    if (token && (hold || selection)) {
      void api(holdPath, { method: 'DELETE', token }).catch(() => undefined);
    }
    setHold(null);
  }

  // Al volver del ingreso se aparta lo elegido; si no, se recupera el apartado vigente.
  useEffect(() => {
    if (!token) return;
    if (restored) {
      void requestHold(restored);
      return;
    }
    api<{ hold: SlotHold | null }>(holdPath, { token })
      .then(({ hold: current }) => {
        const held = current && business.courts.find((c) => c.id === current.courtIds[0]);
        if (!current || !held) return;
        setSport(held.sport);
        setDate(bogotaDateOf(current.start));
        setSelection({ courtIds: current.courtIds, start: current.start, slots: current.slots });
        setHold({ value: current, expiresAt: Date.parse(current.expiresAt) });
        setNow(Date.now());
      })
      .catch(() => undefined);
    // Solo al entrar a la página.
  }, []);

  function choose(courtId: string, start: string) {
    const next = { courtIds: [courtId], start, slots: 1 };
    setSelection(next);
    setError(undefined);
    setNotice(undefined);
    void requestHold(next);
  }

  function changeSlots(slots: number) {
    if (!selection) return;
    const next = { ...selection, slots };
    setSelection(next);
    void requestHold(next);
  }

  /** Suma otra cancha en la misma franja (para jugar varias a la vez). */
  function addCourt(courtId: string) {
    if (!selection) return;
    const next = { ...selection, slots: count, courtIds: [...selection.courtIds, courtId] };
    setSelection(next);
    setNotice(undefined);
    void requestHold(next);
  }

  function removeCourt(courtId: string) {
    if (!selection) return;
    const courtIds = selection.courtIds.filter((id) => id !== courtId);
    if (!courtIds.length) return clearSelection();
    const next = { ...selection, courtIds };
    setSelection(next);
    void requestHold(next);
  }

  function clearSelection() {
    releaseHold();
    setSelection(null);
  }

  async function reserve() {
    if (!selection || !chosen.length) return;
    if (!token) {
      goToLogin({ ...selection, slots: chosen.length });
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const reservation = await api<Reservation>(`/player/businesses/${business.slug}/reservations`, {
        method: 'POST',
        token,
        body: {
          courtIds: selection.courtIds,
          start: selection.start,
          slots: chosen.length,
          notes: notes.trim() || undefined,
        },
      });
      holdSeq.current++;
      setHold(null);
      setBooked(reservation);
      setSelection(null);
      setNotes('');
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        goToLogin({ ...selection, slots: chosen.length });
        return;
      }
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 409) reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BookedDialog business={business} reservation={booked} onClose={() => setBooked(null)} />
      <CourtDetails court={details} onClose={() => setDetails(null)} />

      <Card className="shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Reserva tu cancha</h2>
        <p className="mt-0.5 text-xs text-fg-3">Elige deporte, fecha y horario. Pagas en efectivo en la sede.</p>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Deporte">
          {business.sports.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              onClick={() => {
                if (s === sport) return;
                clearSelection();
                setSport(s);
              }}
              className={`inline-flex min-w-fit flex-1 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs transition active:scale-[0.98] ${
                sport === s
                  ? 'border-transparent bg-accent font-bold text-accent-fg shadow-md shadow-emerald-500/20'
                  : 'border-border bg-surface-2 font-medium text-fg-2 hover:border-slate-500'
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {SPORT_EMOJI[s]}
              </span>
              {SPORT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 py-1" aria-label="Fecha">
          {dates.map((d, i) => {
            const parts = dayParts(d);
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (active) return;
                  clearSelection();
                  setDate(d);
                }}
                className={`flex min-w-14 shrink-0 flex-col items-center rounded-xl border px-1.5 py-2 transition ${
                  active
                    ? 'border-transparent bg-accent text-accent-fg shadow-sm'
                    : 'border-border bg-surface-2 text-fg-2 hover:border-slate-500 hover:text-fg'
                }`}
              >
                <span className={`text-[10px] leading-none ${active ? 'font-semibold uppercase' : 'text-fg-3'}`}>
                  {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : parts.weekday}
                </span>
                <span className={`my-0.5 text-base leading-none ${active ? 'font-extrabold' : 'font-bold text-fg'}`}>
                  {parts.day}
                </span>
                <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'text-fg-3'}`}>{parts.month}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2" role="group" aria-label="Horario">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-1 rounded-xl border px-2 py-2 text-xs transition active:scale-[0.98] ${
                period === p.id
                  ? 'border-transparent bg-accent font-bold text-accent-fg'
                  : 'border-border bg-surface-2 font-medium text-fg-2 hover:border-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5 text-[11px] font-medium text-fg-3">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          Los turnos se actualizan en vivo.
        </p>
      </Card>

      {notice && (
        <div role="status">
          <Alert tone="warn">{notice}</Alert>
        </div>
      )}
      {availability.error && <Alert>{availability.error}</Alert>}
      {availability.loading && !availability.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : availability.data?.courts.length === 0 ? (
        <Alert tone="warn">No hay canchas de {SPORT_LABELS[sport].toLowerCase()} disponibles.</Alert>
      ) : (
        availability.data?.courts.map((c) => (
          <CourtCard
            key={c.court.id}
            court={c}
            rates={business.courts.find((x) => x.id === c.court.id)?.rates ?? []}
            selection={selection}
            chosenCount={count}
            startIndex={runs.find((r) => r.id === c.court.id)?.index ?? -1}
            isFree={isFree}
            period={period}
            onChoose={choose}
            onDetails={
              business.courts.some((x) => x.id === c.court.id)
                ? () => setDetails(business.courts.find((x) => x.id === c.court.id)!)
                : undefined
            }
          />
        ))
      )}

      {selection && court && chosen.length > 0 && runs.every((r) => r.count > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/95 shadow-2xl backdrop-blur-md">
          <div
            className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {error && <Alert>{error}</Alert>}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-3">Turno seleccionado</span>
                <p className="text-sm font-bold">
                  {formatTime(chosen[0].start)} a {formatTime(chosen.at(-1)!.end)}
                </p>
                <p className="text-xs text-fg-3">
                  {runs.length > 1 ? `${runs.length} canchas` : court.court.name} · {formatLongDay(chosen[0].start)}
                </p>
                <HoldStatus token={token} holding={holding} remaining={hold ? remaining : null} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  aria-label="Duración"
                  className={`${inputClass} w-auto !min-h-10 !py-1 text-sm`}
                  value={Math.min(selection.slots, maxCount)}
                  onChange={(e) => changeSlots(Number(e.target.value))}
                >
                  {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {(n * court.court.slotDuration) / 60} h ({n} turno{n > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Quitar selección"
                  className="flex size-10 items-center justify-center rounded-xl border border-border text-fg-3 transition hover:bg-surface-2 hover:text-fg"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Canchas elegidas">
              {runs.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-500/20 bg-accent-soft pl-3 pr-1 text-xs font-semibold text-accent"
                >
                  {r.court?.court.name}
                  {runs.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeCourt(r.id)}
                      aria-label={`Quitar ${r.court?.court.name}`}
                      className="flex size-7 items-center justify-center rounded-full hover:bg-accent/15"
                    >
                      <CloseIcon className="size-3.5" />
                    </button>
                  ) : (
                    <span className="pr-2" />
                  )}
                </span>
              ))}
              {addable.map((c) => (
                <button
                  key={c.court.id}
                  type="button"
                  onClick={() => addCourt(c.court.id)}
                  disabled={holding}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
                >
                  + {c.court.name}
                </button>
              ))}
            </div>
            {selection.courtIds.length < maxCourts && addable.length === 0 && courtsData.length > 1 && (
              <p className="-mt-1 text-xs text-fg-3">No hay otra cancha libre en ese mismo horario para jugar a la vez.</p>
            )}
            <textarea
              rows={1}
              maxLength={200}
              aria-label="Notas para la sede"
              placeholder="Notas para la sede (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} !min-h-10 resize-none py-2 text-sm`}
            />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-extrabold tabular text-accent">{formatMoney(total, court.court.currency)}</p>
                <p className="text-[11px] text-fg-3">Pagas en efectivo en la sede</p>
              </div>
              <Button
                onClick={reserve}
                loading={saving}
                disabled={Boolean(token) && holding}
                className="min-w-44 !rounded-xl px-5 text-xs font-bold tracking-wide shadow-lg shadow-emerald-500/25"
              >
                {token ? 'Confirmar reserva' : 'Ingresa para reservar'}
                <ChevronRightIcon className="size-4" strokeWidth={2.5} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** "Apartado para ti · 2:41" bajo el turno elegido. */
function HoldStatus({ token, holding, remaining }: { token: string | null; holding: boolean; remaining: number | null }) {
  if (!token) {
    return <p className="mt-0.5 text-xs text-fg-3">Ingresa para apartar el turno mientras confirmas.</p>;
  }
  if (holding && remaining === null) {
    return <p className="mt-0.5 text-xs text-fg-3">Apartando el turno…</p>;
  }
  if (remaining === null) return null;
  const urgent = remaining <= 30;
  return (
    <p className={`mt-0.5 text-xs font-semibold ${urgent ? 'text-danger' : 'text-accent'}`} aria-live={urgent ? 'polite' : 'off'}>
      Apartado para ti · <span className="tabular">{formatCountdown(remaining)}</span> para confirmar
    </p>
  );
}

function CourtCard({
  court: { court, availableCount, slots },
  rates,
  selection,
  chosenCount,
  startIndex,
  isFree,
  period,
  onChoose,
  onDetails,
}: {
  court: CourtSlots;
  rates: PublicCourt['rates'];
  selection: Selection | null;
  chosenCount: number;
  startIndex: number;
  isFree: (courtId: string, slot: Slot) => boolean;
  period: DayPeriod | 'all';
  onChoose: (courtId: string, start: string) => void;
  onDetails?: () => void;
}) {
  // Solo lo que el jugador puede tomar, más lo que otro está apartando (vence en minutos).
  const visible = slots
    .map((slot, i) => {
      const selected =
        Boolean(selection?.courtIds.includes(court.id)) && startIndex !== -1 && i >= startIndex && i < startIndex + chosenCount;
      const free = selected || isFree(court.id, slot);
      return { slot, selected, free, inProcess: !free && slot.status === 'HELD' };
    })
    .filter((s) => (s.free || s.inProcess) && (period === 'all' || dayPeriod(s.slot.start) === period));

  return (
    <Card className="shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onDetails}
            disabled={!onDetails}
            aria-label={`Ver detalles de ${court.name}`}
            className="shrink-0 rounded-xl disabled:cursor-default"
          >
            {court.photoUrl ? (
              <ShimmerImage src={court.photoUrl} alt="" wrapperClassName="size-12 rounded-xl border border-border" className="object-cover" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-2xl" aria-hidden="true">
                {SPORT_EMOJI[court.sport]}
              </span>
            )}
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold uppercase leading-snug tracking-wide">{court.name}</h3>
            <p className="text-xs text-fg-3">
              {SPORT_LABELS[court.sport]} · {court.isCovered ? 'Cubierta' : 'Al aire libre'} · Turnos de{' '}
              {court.slotDuration % 60 === 0 ? `${court.slotDuration / 60} h` : `${court.slotDuration} min`}
            </p>
            {courtSpecs(court) && <p className="text-xs text-fg-3">{courtSpecs(court)}</p>}
            {onDetails && (
              <button
                type="button"
                onClick={onDetails}
                className="mt-0.5 inline-flex items-center text-xs font-semibold text-accent transition hover:brightness-125"
              >
                Ver fotos y detalles
                <ChevronRightIcon className="ml-1 size-3.5" />
              </button>
            )}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-500/20 bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
          {availableCount} libre{availableCount === 1 ? '' : 's'}
        </span>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-fg-3">Cerrada este día.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-fg-3">{period === 'all' ? 'No quedan turnos disponibles este día.' : 'No hay turnos disponibles en este horario.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {visible.map(({ slot, selected, free, inProcess }) => {
            const rate = rateAt(rates, slot.start);
            return (
              <button
                key={slot.start}
                type="button"
                disabled={!free}
                aria-pressed={selected}
                onClick={() => onChoose(court.id, slot.start)}
                className={`flex min-h-14 flex-col justify-between rounded-xl border p-2.5 text-left transition ${
                  selected
                    ? 'border-accent bg-accent/10 shadow-sm shadow-emerald-500/10 ring-1 ring-accent'
                    : free
                      ? 'border-border bg-surface-2 hover:border-accent/50'
                      : 'cursor-not-allowed border-dashed border-warn/60 bg-warn-soft text-fg-2'
                }`}
              >
                <span className="flex w-full items-center justify-between gap-1">
                  <span className={`whitespace-nowrap text-sm font-semibold tabular ${selected ? 'text-accent' : ''}`}>
                    {formatTime(slot.start)}
                  </span>
                  {selected ? (
                    <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                  ) : (
                    rate &&
                    free && (
                      <span className="min-w-0 truncate rounded bg-amber-400/10 px-1 text-[9px] font-medium text-amber-400" title={rate.name}>
                        {rate.name}
                      </span>
                    )
                  )}
                </span>
                <span className={`mt-1 text-[11px] tabular ${selected ? 'font-semibold text-accent' : 'text-fg-3'}`}>
                  {inProcess ? 'En proceso' : formatMoney(slot.price, court.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3.5 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-fg-3">
        El valor de cada turno ya incluye la tarifa que le corresponde. Pagas en efectivo en la sede.
      </p>
    </Card>
  );
}

function BookedDialog({
  business,
  reservation: r,
  onClose,
}: {
  business: PublicBusiness;
  reservation: Reservation | null;
  onClose: () => void;
}) {
  if (!r) return null;
  const hours = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 3_600_000;
  const courts = r.group ? r.group.courts.map((c) => c.courtName).join(' + ') : r.courtName;
  const total = r.group?.totalPrice ?? r.totalPrice;
  const paid = r.group?.amountPaid ?? r.amountPaid;
  const balance = r.group?.balance ?? r.balance;
  const initials =
    r.customerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  const when = `${formatLongDay(r.start)} · ${formatTime(r.start)} a ${formatTime(r.end)}`;
  const share = `https://wa.me/?text=${encodeURIComponent(
    `Reserva confirmada en ${business.name}\n${courts} · ${SPORT_LABELS[r.sport]}\n${when}\nTotal: ${formatMoney(total, r.currency)} (pago en efectivo en la sede)\n${business.mapsUrl}`,
  )}`;

  return (
    <Dialog open onClose={onClose} labelledBy="booked-title">
      <div className="pitch-pop">
        <div className="relative flex flex-col items-center text-center">
          <span className="pitch-particle left-12 top-0 size-1.5 bg-emerald-400" style={{ animationDelay: '0.1s' }} aria-hidden="true" />
          <span className="pitch-particle right-12 top-4 size-2 bg-emerald-300" style={{ animationDelay: '0.5s' }} aria-hidden="true" />
          <span className="pitch-particle left-8 top-10 size-1 bg-yellow-400" style={{ animationDelay: '0.9s' }} aria-hidden="true" />

          <div className="relative my-3 flex items-center justify-center" aria-hidden="true">
            <span className="pitch-ring absolute size-20 rounded-full bg-emerald-500/20" />
            <span className="pitch-ring pitch-ring-2 absolute size-20 rounded-full bg-emerald-500/25" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-lg shadow-emerald-500/30">
              <span className="flex size-full items-center justify-center rounded-full bg-surface">
                <svg viewBox="0 0 48 48" className="size-9" fill="none" stroke="#34d399" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                  <path className="pitch-check" d="M14 24.5 21.5 32 34 16" />
                </svg>
              </span>
            </span>
          </div>

          <h2 id="booked-title" className="mt-1 text-2xl font-bold tracking-tight">
            ¡Reserva confirmada!
          </h2>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {business.name}
          </p>
          <p className="mt-1 text-sm text-fg-2">{when}</p>

          <div className="mt-3 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-[11px] font-bold text-slate-950">
              {initials}
            </span>
            <span className="truncate text-sm font-medium">{r.customerName}</span>
            <span className="text-xs text-fg-3">|</span>
            <span className="rounded bg-bg/80 px-1.5 py-0.5 font-mono text-xs text-fg-3">#{r.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        <section aria-label="Resumen de la reserva" className="mt-5 rounded-2xl border border-border bg-bg/40 p-4">
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <div>
              <span className="text-sm text-fg-3">Total turno</span>
              <p className="font-mono text-[11px] text-fg-3">
                {hours.toLocaleString('es-CO')} {hours === 1 ? 'hora' : 'horas'} de juego
              </p>
            </div>
            <span className="text-2xl font-extrabold tabular tracking-tight text-accent">{formatMoney(total, r.currency)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
            <span className="text-fg-3">Pagado online</span>
            <span className="font-medium tabular">{formatMoney(paid, r.currency)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
            <div>
              <span className="font-medium text-fg-2">Saldo a pagar</span>
              <span className="block text-[11px] text-amber-400">En efectivo en la sede</span>
            </div>
            <span className="text-base font-bold tabular">{formatMoney(balance, r.currency)}</span>
          </div>
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-fg-3">{r.group ? 'Canchas' : 'Cancha'}</dt>
              <dd className="text-right font-medium">
                {courts} · {SPORT_LABELS[r.sport]}
              </dd>
            </div>
            {r.contactNote && (
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-fg-3">Notas</dt>
                <dd className="text-right font-medium">{r.contactNote}</dd>
              </div>
            )}
          </dl>
          <div className="flex items-center justify-between pt-3 text-sm">
            <span className="text-fg-3">Estado</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              Confirmada
            </span>
          </div>
        </section>

        <a
          href={share}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-surface-2 px-3 py-2.5 text-xs font-semibold transition hover:border-emerald-500/60 active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24M9.53 6.99c-.17 0-.44.06-.68.32-.23.26-.89.88-.89 2.14s.92 2.48 1.05 2.65c.13.17 1.76 2.8 4.33 3.81 2.13.83 2.57.67 3.03.63.46-.04 1.48-.61 1.69-1.2.21-.59.21-1.09.15-1.19-.07-.11-.24-.17-.5-.3s-1.52-.75-1.75-.84c-.24-.08-.41-.12-.58.13-.17.26-.65.84-.8 1.01-.14.17-.29.19-.55.06-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.27-1.52-1.42-1.77-.14-.26-.01-.4.12-.53.11-.11.25-.29.38-.44s.18-.25.26-.42c.09-.17.04-.32-.02-.44-.06-.13-.58-1.4-.79-1.91-.21-.5-.42-.43-.58-.44z" />
          </svg>
          Compartir por WhatsApp
        </a>

        <p className="mt-3 text-center text-xs text-fg-3">Para cancelar o cambiar la reserva, comunícate con la sede.</p>
        <div className="mt-4 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Link
            to={`/${business.slug}/mis-reservas`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-surface-2"
          >
            Ver mis reservas
          </Link>
          <Button onClick={onClose} className="flex-1">
            Listo
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
