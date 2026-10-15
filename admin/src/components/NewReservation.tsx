import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import {
  formatLongDay,
  formatMoney,
  formatTime,
  SPORT_LABELS,
  todayInBogota,
} from '../lib/format';
import { useToast } from '../lib/toast';
import type { Catalogs, Court, Customer, Sport, SportAvailability } from '../lib/types';
import { useApi, useDebounced } from '../lib/useApi';
import { Badge, Button, ErrorBanner, Field, Input, Modal, Select, Skeleton, Switch } from './ui';

const EMPTY_CUSTOMER = { name: '', phone: '', documentId: '' };

/** Reserva hecha por el super admin en nombre del negocio. */
export function NewReservationModal({
  clientId,
  initialCustomer,
  onClose,
  onCreated,
}: {
  clientId: string;
  /** Cliente ya elegido (p. ej. desde el botón "Reservar" de la lista de clientes). */
  initialCustomer?: Customer;
  onClose: () => void;
  onCreated: () => void;
}) {
  const notify = useToast();
  const courts = useApi<Court[]>(`/admin/clients/${clientId}/courts`);
  const catalogs = useApi<Catalogs>('/catalogs');
  // Deportes con al menos una cancha reservable.
  const sports = [...new Set(courts.data?.filter((c) => c.isBookable).map((c) => c.sport) ?? [])];

  const [sportChoice, setSportChoice] = useState<Sport | ''>('');
  const [date, setDate] = useState(todayInBogota);
  const [selection, setSelection] = useState<{ courtId: string; start: string } | null>(null);
  const [anyCourt, setAnyCourt] = useState(false);
  const [slotCount, setSlotCount] = useState(1);
  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search');
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer ?? null);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [discount, setDiscount] = useState('0');
  const [withPayment, setWithPayment] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'EFECTIVO', reference: '' });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const sport = sportChoice || sports[0];
  const availability = useApi<SportAvailability>(
    sport ? `/admin/clients/${clientId}/availability?date=${date}&sport=${sport}` : null,
  );
  const debouncedSearch = useDebounced(search.trim());
  const customers = useApi<Customer[]>(
    `/admin/clients/${clientId}/customers?search=${encodeURIComponent(debouncedSearch)}`,
  );

  const selectedCourt = availability.data?.courts.find((c) => c.court.id === selection?.courtId);
  const slots = selectedCourt?.slots ?? [];
  const startIndex = slots.findIndex((s) => s.start === selection?.start);
  // Turnos seguidos libres desde el inicio elegido (máximo de la API).
  let maxCount = 0;
  if (startIndex !== -1) {
    while (
      maxCount < (availability.data?.maxSlots ?? 5) &&
      slots[startIndex + maxCount]?.status === 'AVAILABLE'
    ) {
      maxCount++;
    }
  }
  const chosen = startIndex === -1 ? [] : slots.slice(startIndex, startIndex + Math.min(slotCount, maxCount));
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const currency = selectedCourt?.court.currency ?? 'COP';
  const method = catalogs.data?.paymentMethods.find((m) => m.code === payment.method);

  function resetSelection() {
    setSelection(null);
    setSlotCount(1);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selection || !selectedCourt) return setError('Elige un turno disponible');
    if (customerMode === 'search' && !customer) return setError('Elige un cliente o crea uno nuevo');
    setSaving(true);
    setError(undefined);
    try {
      const created = await api<{ courtName: string }>(`/admin/clients/${clientId}/reservations`, {
        method: 'POST',
        body: {
          ...(anyCourt ? { sport } : { courtId: selection.courtId }),
          start: selection.start,
          slots: chosen.length,
          ...(customerMode === 'search'
            ? { customerId: customer!.id }
            : { customer: newCustomer }),
          discount: Number(discount) || 0,
          ...(withPayment && {
            payment: {
              amount: Number(payment.amount),
              method: payment.method,
              reference: payment.reference.trim() || undefined,
            },
          }),
        },
      });
      notify(`Reserva creada en ${created.courtName}`);
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
      document.getElementById('new-reservation')?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Nueva reserva"
      description="Se crea a nombre del negocio, con las mismas reglas que en la app."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="new-reservation" variant="primary" loading={saving} disabled={!chosen.length}>
            Reservar {chosen.length ? `· ${formatMoney(total, currency)}` : ''}
          </Button>
        </>
      }
    >
      <form id="new-reservation" onSubmit={onSubmit} className="flex flex-col gap-6">
        {error && <ErrorBanner message={error} />}

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Deporte" hint="Se muestran todas sus canchas activas y con fotos">
            {(id) =>
              courts.loading && !courts.data ? (
                <Skeleton className="h-10" />
              ) : (
                <Select
                  id={id}
                  value={sport ?? ''}
                  disabled={!sports.length}
                  onChange={(e) => {
                    setSportChoice(e.target.value as Sport);
                    resetSelection();
                  }}
                >
                  {!sports.length && <option value="">No hay canchas reservables</option>}
                  {sports.map((s) => (
                    <option key={s} value={s}>
                      {SPORT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
          <Field label="Fecha">
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                min={todayInBogota()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  resetSelection();
                }}
              />
            )}
          </Field>
        </section>

        {sport && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-3">Cancha y turno</h3>
            <p className="mb-3 text-xs text-fg-3">{formatLongDay(`${date}T12:00:00-05:00`)}</p>
            {availability.error && <ErrorBanner message={availability.error} onRetry={availability.reload} />}
            {availability.loading && !availability.data ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="flex flex-col gap-3">
                {availability.data?.courts.map(({ court, availableCount, slots: courtSlots }) => {
                  const isSelectedCourt = selection?.courtId === court.id;
                  return (
                    <div
                      key={court.id}
                      className={`rounded-xl border p-3 ${isSelectedCourt ? 'border-accent' : 'border-border'}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{court.name}</p>
                          <p className="text-xs text-fg-3">
                            {court.isCovered ? 'Cubierta' : 'Al aire libre'} · turnos de {court.slotDuration} min
                          </p>
                        </div>
                        <Badge tone={availableCount ? 'success' : 'neutral'}>
                          {availableCount} libre{availableCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      {courtSlots.length === 0 ? (
                        <p className="text-sm text-fg-3">Cerrada ese día.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {courtSlots.map((slot, i) => {
                            const selected =
                              isSelectedCourt && startIndex !== -1 && i >= startIndex && i < startIndex + chosen.length;
                            const free = slot.status === 'AVAILABLE';
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                disabled={!free}
                                aria-pressed={selected}
                                onClick={() => {
                                  setSelection({ courtId: court.id, start: slot.start });
                                  setSlotCount(1);
                                }}
                                className={`rounded-lg border px-1 py-1.5 text-center text-sm transition ${
                                  selected
                                    ? 'border-accent bg-accent text-accent-fg'
                                    : free
                                      ? 'border-border bg-surface hover:border-accent'
                                      : 'cursor-not-allowed border-border bg-surface-2 text-fg-3 line-through'
                                }`}
                              >
                                <span className="block font-medium tabular">{formatTime(slot.start)}</span>
                                <span className="block text-[11px] opacity-80">
                                  {slot.status === 'BOOKED'
                                    ? 'Ocupado'
                                    : slot.status === 'PAST'
                                      ? 'Pasado'
                                      : formatMoney(slot.price, court.currency)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedCourt && maxCount > 0 && (
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <Field label="Duración">
                  {(id) => (
                    <Select
                      id={id}
                      className="w-56"
                      value={Math.min(slotCount, maxCount)}
                      onChange={(e) => setSlotCount(Number(e.target.value))}
                    >
                      {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} turno{n > 1 ? 's' : ''} · {(n * selectedCourt.court.slotDuration) / 60} h
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {chosen.length > 0 && (
                  <p className="pb-2 text-sm text-fg-2">
                    {selectedCourt.court.name} · {formatTime(chosen[0].start)} a {formatTime(chosen.at(-1)!.end)}
                  </p>
                )}
                <label className="flex items-center gap-2 pb-2 text-sm text-fg-2">
                  <Switch checked={anyCourt} label="Asignar cualquier cancha libre" onChange={setAnyCourt} />
                  Cualquier cancha de {SPORT_LABELS[sport]} libre a esa hora
                </label>
              </div>
            )}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-3">Cliente</h3>
            <div className="flex gap-1">
              <Button size="sm" variant={customerMode === 'search' ? 'primary' : 'secondary'} onClick={() => setCustomerMode('search')}>
                Existente
              </Button>
              <Button size="sm" variant={customerMode === 'new' ? 'primary' : 'secondary'} onClick={() => setCustomerMode('new')}>
                Nuevo
              </Button>
            </div>
          </div>
          {customerMode === 'search' ? (
            customer ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{customer.name}</p>
                  <p className="text-xs text-fg-2">
                    Tel. {customer.phone} · C.C. {customer.documentId}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCustomer(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar por nombre, teléfono o cédula…"
                  aria-label="Buscar cliente"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {customers.data?.length ? (
                    customers.data.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setCustomer(c)}
                          className="w-full px-3 py-2 text-left hover:bg-surface-2"
                        >
                          <span className="block text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-fg-3">
                            Tel. {c.phone} · C.C. {c.documentId}
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-4 text-center text-sm text-fg-3">
                      {customers.loading ? 'Buscando…' : 'Sin resultados: crea un cliente nuevo.'}
                    </li>
                  )}
                </ul>
              </>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre">
                {(id) => (
                  <Input id={id} required minLength={2} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                )}
              </Field>
              <Field label="Teléfono">
                {(id) => (
                  <Input id={id} type="tel" required value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                )}
              </Field>
              <Field label="Cédula">
                {(id) => (
                  <Input id={id} required value={newCustomer.documentId} onChange={(e) => setNewCustomer({ ...newCustomer, documentId: e.target.value })} />
                )}
              </Field>
              <p className="text-xs text-fg-3 sm:col-span-3">
                Si el teléfono o la cédula ya están registrados, se usa ese cliente con sus datos.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-3 sm:col-span-2">Valor</h3>
          <Field label="Descuento" hint="Se resta del valor de las tarifas">
            {(id) => (
              <Input id={id} type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            )}
          </Field>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 self-end rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <dt className="text-fg-2">Subtotal</dt>
            <dd className="text-right tabular">{formatMoney(subtotal, currency)}</dd>
            <dt className="text-fg-2">Descuento</dt>
            <dd className="text-right tabular">− {formatMoney(Number(discount) || 0, currency)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold tabular">{formatMoney(total, currency)}</dd>
          </dl>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Registrar un pago ahora</p>
              <p className="text-xs text-fg-3">Opcional: anticipo o el total</p>
            </div>
            <Switch checked={withPayment} label="Registrar pago" onChange={setWithPayment} />
          </div>
          {withPayment && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="Monto" hint={Number(payment.amount) >= total && total > 0 ? 'Pago total' : 'Anticipo'}>
                {(id) => (
                  <div className="flex gap-2">
                    <Input id={id} type="number" required min={0.01} step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                    <Button size="md" onClick={() => setPayment({ ...payment, amount: String(total) })}>
                      Total
                    </Button>
                  </div>
                )}
              </Field>
              <Field label="Método">
                {(id) => (
                  <Select id={id} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                    {catalogs.data?.paymentMethods.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {method?.requiresReference && (
                <Field label="Referencia" hint={`Obligatoria para ${method.name}`}>
                  {(id) => (
                    <Input id={id} required value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                  )}
                </Field>
              )}
            </div>
          )}
        </section>
        {!sports.length && courts.data && (
          <Badge tone="warn">El negocio no tiene canchas activas con sus 3 fotos.</Badge>
        )}
      </form>
    </Modal>
  );
}
