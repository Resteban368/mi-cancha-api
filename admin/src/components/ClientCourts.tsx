import { useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import {
  DAY_LABELS,
  DAY_SHORT,
  DAYS,
  formatMoney,
  formatSpan,
  PHOTO_SLOT_LABELS,
  SPORT_LABELS,
} from '../lib/format';
import { useToast } from '../lib/toast';
import type { Court, CourtRate, CourtSchedule, DayOfWeek, Sport } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ImageIcon, PlusIcon } from './icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
} from './ui';

const SPORTS: Sport[] = ['FUTBOL', 'PADEL', 'BALONCESTO', 'VOLEIBOL'];
const SLOT_DURATIONS = [30, 60, 90, 120];
const PHOTO_SLOTS = ['MAIN', 'SURFACE', 'LIGHTING', 'EXTRA_1', 'EXTRA_2'] as const;

/** Canchas del cliente con su detalle; el super admin puede editarlas. */
export function ClientCourts({
  clientId,
  courtLimit,
  onChanged,
}: {
  clientId: string;
  courtLimit: number | null;
  onChanged: () => void;
}) {
  const courts = useApi<Court[]>(`/admin/clients/${clientId}/courts`);
  const [editing, setEditing] = useState<Court | null>(null);
  const activeCount = courts.data?.filter((c) => c.isActive).length ?? 0;

  return (
    <Card
      title="Canchas"
      description={
        courts.data
          ? `${activeCount} activa(s)${courtLimit !== null ? ` de ${courtLimit} que permite el plan` : ''}`
          : undefined
      }
    >
      {courts.error && (
        <div className="p-4">
          <ErrorBanner message={courts.error} onRetry={courts.reload} />
        </div>
      )}
      {courts.loading && !courts.data ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : courts.data?.length === 0 ? (
        <EmptyState title="Aún no ha registrado canchas" />
      ) : (
        courts.data && (
          <Table>
            <thead>
              <tr>
                <Th>Cancha</Th>
                <Th>Horario</Th>
                <Th align="right">Precio base / hora</Th>
                <Th>Estado</Th>
                <Th>
                  <span className="sr-only">Acciones</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {courts.data.map((court) => (
                <tr key={court.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb url={court.photos.find((p) => p.slot === 'MAIN')?.url} />
                      <div>
                        <p className="font-medium">{court.name}</p>
                        <p className="text-xs text-fg-3">
                          {SPORT_LABELS[court.sport]} · {court.isCovered ? 'Cubierta' : 'Al aire libre'} ·
                          turnos de {court.slotDuration} min
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <WeekStrip schedules={court.schedules} />
                    <p className="mt-1 text-xs text-fg-3">
                      {court.rates.length
                        ? `${court.rates.length} tarifa(s) por franja`
                        : 'Sin tarifas por franja'}
                    </p>
                  </Td>
                  <Td align="right" className="tabular whitespace-nowrap">
                    {formatMoney(court.basePricePerHour, court.currency)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={court.isActive ? 'success' : 'neutral'}>
                        {court.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                      {!court.isComplete && <Badge tone="warn">Faltan fotos</Badge>}
                    </div>
                  </Td>
                  <Td align="right">
                    <Button size="sm" onClick={() => setEditing(court)}>
                      Ver y editar
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )
      )}

      {editing && (
        <CourtEditor
          key={editing.id}
          clientId={clientId}
          court={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            courts.reload();
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function Thumb({ url }: { url?: string }) {
  return url ? (
    <img src={url} alt="" className="size-11 shrink-0 rounded-md border border-border object-cover" />
  ) : (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-fg-3">
      <ImageIcon width={16} height={16} />
    </div>
  );
}

/** Siete letras (L M X J V S D): resaltadas las abiertas, con el horario al pasar el cursor. */
function WeekStrip({ schedules }: { schedules: CourtSchedule[] }) {
  return (
    <div className="flex gap-1">
      {DAYS.map((day) => {
        const s = schedules.find((x) => x.dayOfWeek === day);
        const open = s?.isOpen && s.openTime && s.closeTime;
        const label = open
          ? `${DAY_LABELS[day]}: ${formatSpan(s.openTime!, s.closeTime!)}`
          : `${DAY_LABELS[day]}: cerrado`;
        return (
          <span
            key={day}
            title={label}
            aria-label={label}
            className={`flex size-6 items-center justify-center rounded text-[11px] font-semibold ${
              open ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg-3 line-through'
            }`}
          >
            {DAY_SHORT[day]}
          </span>
        );
      })}
    </div>
  );
}

/** Tarifa en edición: el precio queda como texto mientras se escribe. */
interface RateRow extends Omit<CourtRate, 'pricePerHour'> {
  key: number;
  pricePerHour: string;
}

let nextKey = 1;

function CourtEditor({
  clientId,
  court,
  onClose,
  onSaved,
}: {
  clientId: string;
  court: Court;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [form, setForm] = useState({
    name: court.name,
    sport: court.sport,
    isCovered: court.isCovered,
    isActive: court.isActive,
    currency: court.currency,
    basePricePerHour: String(court.basePricePerHour),
    slotDuration: court.slotDuration,
  });
  const [schedules, setSchedules] = useState<CourtSchedule[]>(() =>
    DAYS.map(
      (day) =>
        court.schedules.find((s) => s.dayOfWeek === day) ?? {
          dayOfWeek: day,
          isOpen: false,
          openTime: null,
          closeTime: null,
        },
    ),
  );
  const [rates, setRates] = useState<RateRow[]>(() =>
    court.rates.map((r) => ({ ...r, pricePerHour: String(r.pricePerHour), key: nextKey++ })),
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const setSchedule = (day: DayOfWeek, patch: Partial<CourtSchedule>) =>
    setSchedules((list) => list.map((s) => (s.dayOfWeek === day ? { ...s, ...patch } : s)));
  const setRate = (key: number, patch: Partial<RateRow>) =>
    setRates((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api<Court>(`/admin/clients/${clientId}/courts/${court.id}`, {
        method: 'PATCH',
        body: {
          ...form,
          currency: form.currency.trim().toUpperCase(),
          basePricePerHour: Number(form.basePricePerHour),
          schedules: schedules.map((s) =>
            s.isOpen ? s : { dayOfWeek: s.dayOfWeek, isOpen: false },
          ),
          rates: rates.map(({ key: _key, ...r }) => ({
            ...r,
            pricePerHour: Number(r.pricePerHour),
          })),
        },
      });
      notify(`Cancha ${form.name} actualizada`);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      // El mensaje está arriba del formulario; el modal puede estar desplazado.
      formRef.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={court.name}
      description="Los cambios aplican de inmediato en la app del negocio."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="court-editor" variant="primary" loading={saving}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form ref={formRef} id="court-editor" onSubmit={onSubmit} className="flex flex-col gap-6">
        {error && <ErrorBanner message={error} />}

        <section>
          <SectionTitle>Fotos</SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PHOTO_SLOTS.map((slot) => {
              const photo = court.photos.find((p) => p.slot === slot);
              const required = slot === 'MAIN' || slot === 'SURFACE' || slot === 'LIGHTING';
              return (
                <figure key={slot} className="flex flex-col gap-1">
                  {photo ? (
                    <a href={photo.url} target="_blank" rel="noreferrer">
                      <img
                        src={photo.url}
                        alt={PHOTO_SLOT_LABELS[slot]}
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                    </a>
                  ) : (
                    <div
                      className={`flex aspect-square w-full items-center justify-center rounded-lg border border-dashed text-fg-3 ${
                        required ? 'border-warn bg-warn-soft' : 'border-border bg-surface-2'
                      }`}
                    >
                      <ImageIcon />
                    </div>
                  )}
                  <figcaption className="text-center text-xs text-fg-2">
                    {PHOTO_SLOT_LABELS[slot]}
                    {required && !photo && <span className="block text-warn">Obligatoria</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-fg-3">Las fotos las sube el negocio desde la app.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <SectionTitle className="sm:col-span-2">Datos de la cancha</SectionTitle>
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                required
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Deporte">
            {(id) => (
              <Select
                id={id}
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {SPORT_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Precio base por hora" hint="Se cobra donde ninguna tarifa aplica">
            {(id) => (
              <Input
                id={id}
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.basePricePerHour}
                onChange={(e) => setForm({ ...form, basePricePerHour: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Moneda" hint="ISO, p. ej. COP">
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              )}
            </Field>
            <Field label="Turno">
              {(id) => (
                <Select
                  id={id}
                  value={form.slotDuration}
                  onChange={(e) => setForm({ ...form, slotDuration: Number(e.target.value) })}
                >
                  {SLOT_DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Toggle
            label="Cubierta"
            hint="Con techo; si no, al aire libre"
            checked={form.isCovered}
            onChange={(isCovered) => setForm({ ...form, isCovered })}
          />
          <Toggle
            label="Activa"
            hint="Cuenta para el límite del plan"
            checked={form.isActive}
            onChange={(isActive) => setForm({ ...form, isActive })}
          />
        </section>

        <section>
          <SectionTitle>Horario semanal</SectionTitle>
          <p className="mb-3 text-xs text-fg-3">
            Si el cierre es menor que la apertura, cierra al día siguiente (p. ej. 18:00 a 02:00).
          </p>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {schedules.map((s) => (
              <div key={s.dayOfWeek} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <Switch
                  checked={s.isOpen}
                  label={`${DAY_LABELS[s.dayOfWeek]} ${s.isOpen ? 'abierto' : 'cerrado'}`}
                  onChange={(isOpen) =>
                    setSchedule(s.dayOfWeek, {
                      isOpen,
                      openTime: s.openTime ?? '06:00',
                      closeTime: s.closeTime ?? '23:00',
                    })
                  }
                />
                <span className="w-24 text-sm font-medium">{DAY_LABELS[s.dayOfWeek]}</span>
                {s.isOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      required
                      aria-label={`Apertura ${DAY_LABELS[s.dayOfWeek]}`}
                      className="h-9 w-32"
                      value={s.openTime ?? ''}
                      onChange={(e) => setSchedule(s.dayOfWeek, { openTime: e.target.value })}
                    />
                    <span className="text-fg-3">a</span>
                    <Input
                      type="time"
                      required
                      aria-label={`Cierre ${DAY_LABELS[s.dayOfWeek]}`}
                      className="h-9 w-32"
                      value={s.closeTime ?? ''}
                      onChange={(e) => setSchedule(s.dayOfWeek, { closeTime: e.target.value })}
                    />
                    {s.openTime && s.closeTime && s.closeTime <= s.openTime && (
                      <Badge>+1 día</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-fg-3">Cerrado</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle className="mb-0">Tarifas por franja</SectionTitle>
            <Button
              size="sm"
              onClick={() =>
                setRates((list) => [
                  ...list,
                  {
                    key: nextKey++,
                    name: '',
                    pricePerHour: form.basePricePerHour,
                    days: [],
                    startTime: '18:00',
                    endTime: '23:00',
                  },
                ])
              }
            >
              <PlusIcon /> Agregar tarifa
            </Button>
          </div>
          {rates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-3">
              Sin tarifas: todas las horas se cobran al precio base.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {rates.map((rate) => (
                <div key={rate.key} className="rounded-lg border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                    <Input
                      required
                      maxLength={40}
                      placeholder="Nombre, p. ej. Nocturna L-V"
                      aria-label="Nombre de la tarifa"
                      value={rate.name}
                      onChange={(e) => setRate(rate.key, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      aria-label="Precio por hora"
                      value={rate.pricePerHour}
                      onChange={(e) => setRate(rate.key, { pricePerHour: e.target.value })}
                    />
                    <Button
                      size="md"
                      variant="ghost"
                      onClick={() => setRates((list) => list.filter((r) => r.key !== rate.key))}
                    >
                      Quitar
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1" role="group" aria-label="Días de la tarifa">
                      {DAYS.map((day) => {
                        const on = rate.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={on}
                            title={DAY_LABELS[day]}
                            onClick={() =>
                              setRate(rate.key, {
                                days: on
                                  ? rate.days.filter((d) => d !== day)
                                  : DAYS.filter((d) => d === day || rate.days.includes(d)),
                              })
                            }
                            className={`size-8 rounded-md text-xs font-semibold transition ${
                              on
                                ? 'bg-accent text-accent-fg'
                                : 'border border-border bg-surface text-fg-2 hover:bg-surface-2'
                            }`}
                          >
                            {DAY_SHORT[day]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        required
                        aria-label="Inicio de la franja"
                        className="h-9 w-32"
                        value={rate.startTime}
                        onChange={(e) => setRate(rate.key, { startTime: e.target.value })}
                      />
                      <span className="text-fg-3">a</span>
                      <Input
                        type="time"
                        required
                        aria-label="Fin de la franja"
                        className="h-9 w-32"
                        value={rate.endTime}
                        onChange={(e) => setRate(rate.key, { endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  {rate.days.length === 0 && (
                    <p className="mt-2 text-xs text-warn">Elige al menos un día.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </form>
    </Modal>
  );
}

function SectionTitle({ children, className = '' }: { children: string; className?: string }) {
  return (
    <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wide text-fg-3 ${className}`}>
      {children}
    </h3>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-fg-3">{hint}</p>
      </div>
      <Switch checked={checked} label={label} onChange={onChange} />
    </div>
  );
}
