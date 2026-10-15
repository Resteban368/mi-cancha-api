import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Header } from '../components/Header';
import { Alert, Button, Card, Dialog, inputClass, Skeleton } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import {
  bogotaDate,
  dayParts,
  formatLongDay,
  formatMoney,
  formatTime,
  SPORT_EMOJI,
  SPORT_LABELS,
} from '../lib/format';
import { useSession } from '../lib/session';
import type { CourtSlots, PublicBusiness, Reservation, Sport, SportAvailability } from '../lib/types';
import { useApi } from '../lib/useApi';

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  DISABLED: 'Esta sede no tiene activas las reservas en línea por ahora.',
  PLAN_INACTIVE: 'Esta sede no está recibiendo reservas en línea en este momento.',
  NO_COURTS: 'Esta sede aún no tiene canchas disponibles para reservar en línea.',
};

interface Selection {
  courtId: string;
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
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

export function BusinessPage() {
  const { slug = '' } = useParams();
  const business = useApi<PublicBusiness>(`/public/businesses/${slug}`);

  return (
    <>
      <Header slug={slug} businessName={business.data?.name} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-40 pt-4">
        {business.error ? (
          <Alert>{business.error}</Alert>
        ) : !business.data ? (
          <>
            <Skeleton className="h-48" />
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </>
        ) : (
          <>
            <BusinessInfo business={business.data} />
            {business.data.bookingAvailable ? (
              <Booking business={business.data} />
            ) : (
              <Alert tone="warn">
                {UNAVAILABLE_MESSAGES[business.data.unavailableReason ?? 'DISABLED']}
              </Alert>
            )}
          </>
        )}
      </main>
    </>
  );
}

function BusinessInfo({ business: b }: { business: PublicBusiness }) {
  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      {b.imageUrl ? (
        <img src={b.imageUrl} alt={`Sede ${b.name}`} className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]" />
      ) : (
        <div className="flex aspect-[21/9] items-center justify-center bg-accent-soft text-5xl" aria-hidden="true">
          🏟️
        </div>
      )}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{b.name}</h1>
          <p className="mt-1 text-sm text-fg-2">
            {b.address} · {b.neighborhood}
          </p>
        </div>
        <a
          href={b.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          📍 Ver ubicación en Google Maps
        </a>
        {b.description && <p className="text-sm leading-relaxed text-fg-2">{b.description}</p>}
        {b.amenities.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">Servicios e instalaciones</h2>
            <ul className="flex flex-wrap gap-2">
              {b.amenities.map((a) => (
                <li key={a.code} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-fg-2">
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

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
  const [booked, setBooked] = useState<Reservation | null>(null);

  const availability = useApi<SportAvailability>(
    `/public/businesses/${business.slug}/availability?date=${date}&sport=${sport}`,
  );
  const dates = Array.from({ length: business.rules.maxDaysAhead + 1 }, (_, i) => bogotaDate(i));

  const court = availability.data?.courts.find((c) => c.court.id === selection?.courtId);
  const startIndex = court?.slots.findIndex((s) => s.start === selection?.start) ?? -1;
  let maxCount = 0;
  if (court && startIndex !== -1) {
    while (maxCount < business.rules.maxSlots && court.slots[startIndex + maxCount]?.status === 'AVAILABLE') {
      maxCount++;
    }
  }
  const chosen = court && startIndex !== -1 ? court.slots.slice(startIndex, startIndex + Math.min(selection!.slots, maxCount)) : [];
  const total = chosen.reduce((sum, s) => sum + s.price, 0);

  // Si la selección guardada ya no está libre, se descarta.
  useEffect(() => {
    if (availability.data && selection && maxCount === 0) setSelection(null);
  }, [availability.data, selection, maxCount]);

  function choose(courtId: string, start: string) {
    setSelection({ courtId, start, slots: 1 });
    setError(undefined);
  }

  async function reserve() {
    if (!selection || !chosen.length) return;
    if (!token) {
      savePending(business.slug, { ...selection, slots: chosen.length, sport, date, notes });
      navigate(`/${business.slug}/ingresar`);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const reservation = await api<Reservation>(`/player/businesses/${business.slug}/reservations`, {
        method: 'POST',
        token,
        body: { courtId: selection.courtId, start: selection.start, slots: chosen.length, notes: notes.trim() || undefined },
      });
      setBooked(reservation);
      setSelection(null);
      setNotes('');
      availability.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        savePending(business.slug, { ...selection, slots: chosen.length, sport, date, notes });
        signOut();
        navigate(`/${business.slug}/ingresar`);
        return;
      }
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 409) availability.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BookedDialog business={business} reservation={booked} onClose={() => setBooked(null)} />

      <Card>
        <h2 className="text-lg font-bold">Reserva tu cancha</h2>
        <p className="mt-1 text-sm text-fg-2">
          Elige deporte, fecha y horario. Pagas en efectivo en la sede.
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Deporte">
          {business.sports.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              onClick={() => {
                setSport(s);
                setSelection(null);
              }}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
                sport === s ? 'border-accent bg-accent text-accent-fg' : 'border-border text-fg-2 hover:bg-surface-2'
              }`}
            >
              {SPORT_EMOJI[s]} {SPORT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Fecha">
          {dates.map((d, i) => {
            const parts = dayParts(d);
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setDate(d);
                  setSelection(null);
                }}
                className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition ${
                  active ? 'border-accent bg-accent text-accent-fg' : 'border-border hover:bg-surface-2'
                }`}
              >
                <span className="font-medium">{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : parts.weekday}</span>
                <span className="text-lg font-bold leading-tight">{parts.day}</span>
                <span className={active ? '' : 'text-fg-3'}>{parts.month}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {availability.error && <Alert>{availability.error}</Alert>}
      {availability.loading && !availability.data ? (
        <Skeleton className="h-64" />
      ) : availability.data?.courts.length === 0 ? (
        <Alert tone="warn">No hay canchas de {SPORT_LABELS[sport].toLowerCase()} disponibles.</Alert>
      ) : (
        availability.data?.courts.map((c) => (
          <CourtCard
            key={c.court.id}
            court={c}
            selection={selection}
            chosenCount={chosen.length}
            startIndex={court?.court.id === c.court.id ? startIndex : -1}
            onChoose={choose}
          />
        ))
      )}

      {selection && court && chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {court.court.name} · {formatTime(chosen[0].start)} a {formatTime(chosen.at(-1)!.end)}
                </p>
                <p className="text-xs text-fg-3">{formatLongDay(chosen[0].start)}</p>
              </div>
              <select
                aria-label="Duración"
                className={`${inputClass} w-auto`}
                value={Math.min(selection.slots, maxCount)}
                onChange={(e) => setSelection({ ...selection, slots: Number(e.target.value) })}
              >
                {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {(n * court.court.slotDuration) / 60} h ({n} turno{n > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              maxLength={200}
              placeholder="Notas para la sede (opcional): p. ej. llevamos balón, somos 10…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} py-2`}
            />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold tabular">{formatMoney(total, court.court.currency)}</p>
                <p className="text-xs text-fg-3">Pagas en efectivo en la sede</p>
              </div>
              <Button onClick={reserve} loading={saving} className="min-w-40">
                {token ? 'Reservar' : 'Ingresa para reservar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CourtCard({
  court: { court, availableCount, slots },
  selection,
  chosenCount,
  startIndex,
  onChoose,
}: {
  court: CourtSlots;
  selection: Selection | null;
  chosenCount: number;
  startIndex: number;
  onChoose: (courtId: string, start: string) => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        {court.photoUrl ? (
          <img src={court.photoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl" aria-hidden="true">
            {SPORT_EMOJI[court.sport]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{court.name}</h3>
          <p className="text-xs text-fg-3">
            {SPORT_LABELS[court.sport]} · {court.isCovered ? 'Cubierta' : 'Al aire libre'} · Turnos de{' '}
            {court.slotDuration % 60 === 0 ? `${court.slotDuration / 60} h` : `${court.slotDuration} min`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
          {availableCount} libre{availableCount === 1 ? '' : 's'}
        </span>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-fg-3">Cerrada este día.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots.map((slot, i) => {
            const free = slot.status === 'AVAILABLE';
            const selected = selection?.courtId === court.id && startIndex !== -1 && i >= startIndex && i < startIndex + chosenCount;
            return (
              <button
                key={slot.start}
                type="button"
                disabled={!free}
                aria-pressed={selected}
                onClick={() => onChoose(court.id, slot.start)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm transition ${
                  selected
                    ? 'border-accent bg-accent text-accent-fg'
                    : free
                      ? 'border-border bg-surface hover:border-accent'
                      : 'cursor-not-allowed border-transparent bg-surface-2 text-fg-3'
                }`}
              >
                <span className={`font-semibold tabular ${free || selected ? '' : 'line-through'}`}>{formatTime(slot.start)}</span>
                <span className="text-[11px] opacity-80">
                  {free ? formatMoney(slot.price, court.currency) : slot.status === 'BOOKED' ? 'Ocupado' : 'No disponible'}
                </span>
              </button>
            );
          })}
        </div>
      )}
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
  const rows: [string, string][] = [
    ['Sede', business.name],
    ['Cancha', `${r.courtName} · ${SPORT_LABELS[r.sport]}`],
    ['Fecha', formatLongDay(r.start)],
    ['Horario', `${formatTime(r.start)} a ${formatTime(r.end)} (${hours.toLocaleString('es-CO')} h)`],
    ['A nombre de', r.customerName],
    ['Total', formatMoney(r.totalPrice, r.currency)],
    ['Pago', 'En efectivo al llegar a la sede'],
  ];
  if (r.contactNote) rows.push(['Notas', r.contactNote]);

  return (
    <Dialog open onClose={onClose} labelledBy="booked-title">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-3xl" aria-hidden="true">
          ✅
        </span>
        <h2 id="booked-title" className="mt-3 text-xl font-bold">
          ¡Reserva confirmada!
        </h2>
        <p className="mt-1 text-sm text-fg-2">
          Gracias por reservar con nosotros. Te esperamos en {business.name}.
        </p>
      </div>
      <dl className="mt-5 divide-y divide-border rounded-2xl border border-border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-fg-3">{label}</dt>
            <dd className={`text-right ${label === 'Total' ? 'font-bold tabular' : 'font-medium'}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-center text-xs text-fg-3">
        Para cancelar o cambiar la reserva, comunícate con la sede.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <Button onClick={onClose} className="flex-1">
          Listo
        </Button>
        <Link
          to={`/${business.slug}/mis-reservas`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface-2"
        >
          Ver mis reservas
        </Link>
      </div>
    </Dialog>
  );
}
