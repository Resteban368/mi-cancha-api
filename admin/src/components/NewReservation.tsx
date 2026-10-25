import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import {
  formatDate,
  formatDocument,
  formatLongDay,
  formatMoney,
  formatPhone,
  formatTime,
  SPORT_LABELS,
  todayInBogota,
} from '../lib/format';
import { useToast } from '../lib/toast';
import type { Catalogs, Court, Customer, Sport, SportAvailability } from '../lib/types';
import { useApi, useDebounced } from '../lib/useApi';
import {
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  CreditCardIcon,
  SearchIcon,
  TagIcon,
  UserPlusIcon,
  UsersIcon,
} from './icons';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Switch,
} from './ui';

const EMPTY_CUSTOMER = { name: '', phone: '', documentId: '' };

const SPORT_EMOJIS: Record<string, string> = {
  FUTBOL: '⚽',
  PADEL: '🎾',
  BALONCESTO: '🏀',
  VOLEIBOL: '🏐',
};

function getUpcomingDays(count = 7) {
  const result = [];
  const todayStr = todayInBogota();
  const [year, month, day] = todayStr.split('-').map(Number);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let i = 0; i < count; i++) {
    const d = new Date(year, month - 1, day + i, 12, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayOfMonth}`;
    const dayName = dayNames[d.getDay()];
    const dayNum = String(d.getDate());

    result.push({
      dateStr,
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${dayName} ${dayNum}`,
      dayName,
      dayNum,
      isToday: i === 0,
      isTomorrow: i === 1,
    });
  }
  return result;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Reserva hecha por el super admin en nombre del negocio con experiencia web moderna. */
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

  // Deportes con al menos una cancha reservable
  const sports = [...new Set(courts.data?.filter((c) => c.isBookable).map((c) => c.sport) ?? [])];

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
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

  const upcomingDays = getUpcomingDays(7);
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

  const chosen =
    startIndex === -1
      ? []
      : slots.slice(startIndex, startIndex + Math.min(slotCount, maxCount));
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const currency = selectedCourt?.court.currency ?? 'COP';
  const method = catalogs.data?.paymentMethods.find((m) => m.code === payment.method);

  // Sincronizar monto inicial de pago con el total si se habilita pago
  useEffect(() => {
    if (withPayment && (!payment.amount || Number(payment.amount) === 0)) {
      setPayment((prev) => ({ ...prev, amount: String(total) }));
    }
  }, [withPayment, total]);

  function resetSelection() {
    setSelection(null);
    setSlotCount(1);
  }

  function handleQuickDiscount(amount: number) {
    setDiscount(String(amount));
  }

  async function onSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    if (!selection || !selectedCourt || !chosen.length) {
      setActiveStep(1);
      return setError('Debes seleccionar un turno disponible');
    }
    if (customerMode === 'search' && !customer) {
      setActiveStep(2);
      return setError('Selecciona un cliente o crea uno nuevo');
    }
    if (customerMode === 'new') {
      if (!newCustomer.name.trim() || !newCustomer.phone.trim() || !newCustomer.documentId.trim()) {
        setActiveStep(2);
        return setError('Completa todos los datos requeridos del nuevo cliente');
      }
    }

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
      notify(`Reserva confirmada con éxito en ${created.courtName}`);
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
      document.getElementById('new-reservation-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  const isStep1Valid = Boolean(selection && chosen.length > 0);
  const isStep2Valid = Boolean(
    (customerMode === 'search' && customer) ||
      (customerMode === 'new' && newCustomer.name.trim() && newCustomer.phone.trim() && newCustomer.documentId.trim()),
  );

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title="Nueva reserva"
      description="Crea y agenda reservas de forma rápida e intuitiva con cálculo automático de tarifas."
      footer={
        <div className="flex w-full flex-col-reverse items-center justify-between gap-3 sm:flex-row">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start sm:gap-4">
            <span className="text-xs text-fg-3">
              {chosen.length > 0 ? (
                <>
                  <span className="font-semibold text-fg">
                    {formatMoney(total, currency)}
                  </span>
                  {' · '}
                  <span>{chosen.length} turno{chosen.length > 1 ? 's' : ''}</span>
                  {selectedCourt && <span> · {selectedCourt.court.name}</span>}
                </>
              ) : (
                'Sin turno seleccionado'
              )}
            </span>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {activeStep > 1 && (
              <Button
                variant="secondary"
                onClick={() => setActiveStep((prev) => (prev - 1) as 1 | 2)}
                disabled={saving}
              >
                Anterior
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            {activeStep < 3 ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (activeStep === 1 && !isStep1Valid) {
                    setError('Por favor selecciona una cancha y turno');
                    return;
                  }
                  if (activeStep === 2 && !isStep2Valid) {
                    setError('Por favor selecciona o ingresa los datos del cliente');
                    return;
                  }
                  setError(undefined);
                  setActiveStep((prev) => (prev + 1) as 2 | 3);
                }}
                disabled={activeStep === 1 ? !isStep1Valid : !isStep2Valid}
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!isStep1Valid || !isStep2Valid}
                onClick={() => onSubmit()}
              >
                Confirmar Reserva · {formatMoney(total, currency)}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div id="new-reservation-scroll" className="flex flex-col gap-6">
        {error && <ErrorBanner message={error} />}

        {/* Stepper Navigation */}
        <nav aria-label="Progreso" className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { num: 1, title: 'Cancha y Horario', icon: CalendarIcon, ready: isStep1Valid },
              { num: 2, title: 'Cliente', icon: UsersIcon, ready: isStep2Valid },
              { num: 3, title: 'Pago y Confirmación', icon: CreditCardIcon, ready: isStep1Valid && isStep2Valid },
            ].map((stepItem, idx) => {
              const isActive = activeStep === stepItem.num;
              const isDone = activeStep > stepItem.num;
              const IconComp = stepItem.icon;

              return (
                <div key={stepItem.num} className="flex items-center gap-2">
                  {idx > 0 && (
                    <div
                      className={`h-0.5 w-4 sm:w-8 transition-colors ${
                        isDone ? 'bg-accent' : 'bg-border'
                      }`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (stepItem.num === 1 || (stepItem.num === 2 && isStep1Valid) || (stepItem.num === 3 && isStep1Valid && isStep2Valid)) {
                        setActiveStep(stepItem.num as 1 | 2 | 3);
                      }
                    }}
                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-accent-soft text-accent-text ring-1 ring-accent'
                        : isDone
                          ? 'text-accent-text hover:bg-surface-2'
                          : 'text-fg-3 hover:text-fg'
                    }`}
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-accent text-accent-fg'
                          : isDone
                            ? 'bg-accent-soft text-accent-text'
                            : 'bg-surface-2 text-fg-3'
                      }`}
                    >
                      {isDone ? <CheckIcon className="size-3.5" /> : <IconComp className="size-3.5" />}
                    </span>
                    <span className="hidden md:inline">{stepItem.title}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {chosen.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-fg-2">
              <span className="inline-block size-2 rounded-full bg-accent animate-pulse" />
              <span>{formatTime(chosen[0].start)} – {formatTime(chosen.at(-1)!.end)}</span>
            </div>
          )}
        </nav>

        {/* PASO 1: Cancha, Deporte, Fecha y Turnos */}
        {activeStep === 1 && (
          <div className="flex flex-col gap-6">
            {/* Selector de Deporte en Chips */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-fg-3">
                1. Selecciona el Deporte
              </label>
              {courts.loading && !courts.data ? (
                <div className="flex gap-2">
                  <Skeleton className="h-11 w-32" />
                  <Skeleton className="h-11 w-32" />
                </div>
              ) : !sports.length ? (
                <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-fg-3">
                  Este negocio no cuenta con canchas reservables activas.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {sports.map((s) => {
                    const isSelected = sport === s;
                    const courtCount = courts.data?.filter((c) => c.sport === s && c.isBookable).length ?? 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSportChoice(s);
                          resetSelection();
                        }}
                        className={`group relative flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                          isSelected
                            ? 'border-accent bg-accent-soft text-accent-text shadow-sm ring-1 ring-accent'
                            : 'border-border bg-surface text-fg hover:border-accent/60 hover:bg-surface-2'
                        }`}
                      >
                        <span className="text-lg">{SPORT_EMOJIS[s] ?? '🏆'}</span>
                        <div className="text-left">
                          <p className="font-semibold leading-tight">{SPORT_LABELS[s] ?? s}</p>
                          <p className="text-[11px] text-fg-3">
                            {courtCount} cancha{courtCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="ml-1 text-accent-text">
                            <CheckCircleIcon className="size-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selector de Fecha: Tira de Días + Input Date */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-fg-3">
                  2. Fecha del Juego
                </label>
                <span className="text-xs font-medium text-fg-2">
                  {formatLongDay(`${date}T12:00:00-05:00`)}
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Carrusel de Días Próximos */}
                <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {upcomingDays.map((item) => {
                    const isSelected = date === item.dateStr;
                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => {
                          setDate(item.dateStr);
                          resetSelection();
                        }}
                        className={`flex min-w-16 flex-1 flex-col items-center justify-center rounded-xl border py-2 px-1 text-xs transition ${
                          isSelected
                            ? 'border-accent bg-accent text-accent-fg shadow-sm'
                            : 'border-border bg-surface text-fg hover:border-accent/50 hover:bg-surface-2'
                        }`}
                      >
                        <span className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-accent-fg/80' : 'text-fg-3'}`}>
                          {item.dayName}
                        </span>
                        <span className="text-base font-bold tabular">{item.dayNum}</span>
                        <span className={`text-[9px] ${isSelected ? 'text-accent-fg/90' : 'text-fg-3'}`}>
                          {item.isToday ? 'Hoy' : item.isTomorrow ? 'Mañana' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Input de Fecha Calendario */}
                <div className="sm:w-44">
                  <Input
                    type="date"
                    min={todayInBogota()}
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(e.target.value);
                        resetSelection();
                      }
                    }}
                    className="h-12 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Parrilla de Canchas y Turnos */}
            {sport && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-fg-3">
                    3. Elige Cancha y Turno Disponible
                  </label>
                  {availability.data && (
                    <span className="text-xs text-fg-3">
                      {availability.data.courts.reduce((acc, c) => acc + c.availableCount, 0)} turnos libres hoy
                    </span>
                  )}
                </div>

                {availability.error && (
                  <ErrorBanner message={availability.error} onRetry={availability.reload} />
                )}

                {availability.loading && !availability.data ? (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                  </div>
                ) : availability.data?.courts.length === 0 ? (
                  <EmptyState title="No hay canchas registradas para este deporte" />
                ) : (
                  <div className="flex flex-col gap-4">
                    {availability.data?.courts.map(({ court, availableCount, slots: courtSlots }) => {
                      const isSelectedCourt = selection?.courtId === court.id;
                      return (
                        <div
                          key={court.id}
                          className={`relative overflow-hidden rounded-2xl border transition-all ${
                            isSelectedCourt
                              ? 'border-accent bg-accent-soft/20 shadow-md ring-1 ring-accent'
                              : 'border-border bg-surface hover:border-border/80'
                          }`}
                        >
                          {/* Cabecera de Cancha */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface-2/40 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold">
                                {SPORT_EMOJIS[court.sport] ?? '🏟️'}
                              </span>
                              <div>
                                <h4 className="font-semibold text-fg text-sm">{court.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-fg-3">
                                  <span>{court.isCovered ? '🏠 Cubierta' : '☀️ Al aire libre'}</span>
                                  <span>·</span>
                                  <span>Turnos de {court.slotDuration} min</span>
                                </div>
                              </div>
                            </div>
                            <Badge tone={availableCount > 0 ? 'success' : 'neutral'}>
                              {availableCount > 0 ? `${availableCount} libre${availableCount > 1 ? 's' : ''}` : 'Sin turnos'}
                            </Badge>
                          </div>

                          {/* Grid de Horarios */}
                          <div className="p-4">
                            {courtSlots.length === 0 ? (
                              <p className="py-4 text-center text-xs text-fg-3">
                                Cancha cerrada o sin horario configurado para este día.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                                {courtSlots.map((slot, i) => {
                                  const isSelectedSlot =
                                    isSelectedCourt &&
                                    startIndex !== -1 &&
                                    i >= startIndex &&
                                    i < startIndex + chosen.length;
                                  const isFree = slot.status === 'AVAILABLE';

                                  return (
                                    <button
                                      key={slot.start}
                                      type="button"
                                      disabled={!isFree}
                                      aria-pressed={isSelectedSlot}
                                      onClick={() => {
                                        setSelection({ courtId: court.id, start: slot.start });
                                        setSlotCount(1);
                                      }}
                                      className={`group relative flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                                        isSelectedSlot
                                          ? 'border-accent bg-accent text-accent-fg shadow-sm ring-2 ring-accent ring-offset-1'
                                          : isFree
                                            ? 'border-border bg-surface text-fg hover:border-accent hover:shadow-sm'
                                            : slot.status === 'BOOKED'
                                              ? 'cursor-not-allowed border-border/50 bg-surface-2/60 text-fg-3 opacity-60'
                                              : 'cursor-not-allowed border-border/30 bg-surface-2 text-fg-3/60 line-through'
                                      }`}
                                    >
                                      <span className="text-xs font-bold tabular">
                                        {formatTime(slot.start)}
                                      </span>
                                      <span
                                        className={`mt-0.5 text-[11px] tabular ${
                                          isSelectedSlot
                                            ? 'text-accent-fg/90 font-medium'
                                            : isFree
                                              ? 'text-accent-text font-semibold'
                                              : 'text-fg-3'
                                        }`}
                                      >
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Ajustes de Duración y Turnos Continuos */}
            {selectedCourt && maxCount > 0 && (
              <div className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-accent-text">
                      Duración de la Reserva
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => {
                        const durationMins = n * selectedCourt.court.slotDuration;
                        const durationHours = durationMins / 60;
                        const isChosenCount = slotCount === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSlotCount(n)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              isChosenCount
                                ? 'bg-accent text-accent-fg shadow-sm'
                                : 'bg-surface border border-border text-fg hover:border-accent'
                            }`}
                          >
                            {n} turno{n > 1 ? 's' : ''} ({durationHours >= 1 ? `${durationHours} h` : `${durationMins} min`})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {chosen.length > 0 && (
                    <div className="rounded-xl bg-surface px-4 py-2.5 border border-border text-right">
                      <p className="text-xs text-fg-3">Horario Reservado</p>
                      <p className="text-sm font-bold text-fg">
                        {formatTime(chosen[0].start)} a {formatTime(chosen.at(-1)!.end)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-border/40 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={anyCourt}
                      label="Asignar cualquier cancha libre"
                      onChange={setAnyCourt}
                    />
                    <span className="text-xs text-fg-2">
                      Asignar automáticamente cualquier otra cancha de {SPORT_LABELS[sport]} libre en este horario
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: Cliente */}
        {activeStep === 2 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">Titular de la Reserva</h3>
                <p className="text-xs text-fg-3">
                  Selecciona a quién quedará asignada esta reserva
                </p>
              </div>
              <div className="flex rounded-xl bg-surface-2 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setCustomerMode('search')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    customerMode === 'search'
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-3 hover:text-fg'
                  }`}
                >
                  <SearchIcon className="size-3.5" />
                  Cliente Existente
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    customerMode === 'new'
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-3 hover:text-fg'
                  }`}
                >
                  <UserPlusIcon className="size-3.5" />
                  Nuevo Cliente
                </button>
              </div>
            </div>

            {customerMode === 'search' ? (
              customer ? (
                /* Tarjeta de Cliente Seleccionado */
                <div className="relative overflow-hidden rounded-2xl border border-accent bg-accent-soft/30 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg font-bold text-base shadow-sm">
                        {getInitials(customer.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-fg">{customer.name}</h4>
                          <Badge tone="success">Cliente Asignado</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
                          <span>📞 {formatPhone(customer.phone)}</span>
                          <span>🆔 C.C. {formatDocument(customer.documentId)}</span>
                          {customer.preferredSport && (
                            <span>🏆 {SPORT_LABELS[customer.preferredSport] ?? customer.preferredSport}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setCustomer(null)}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : (
                /* Buscador de Clientes */
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-fg-3">
                      <SearchIcon className="size-4" />
                    </div>
                    <Input
                      placeholder="Buscar por nombre, teléfono o cédula…"
                      aria-label="Buscar cliente"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-fg-3 hover:text-fg"
                      >
                        <CloseIcon className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface divide-y divide-border">
                    {customers.loading && !customers.data ? (
                      <div className="p-4 flex flex-col gap-2">
                        <Skeleton className="h-12 rounded-xl" />
                        <Skeleton className="h-12 rounded-xl" />
                      </div>
                    ) : customers.data?.length ? (
                      customers.data.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3.5 transition hover:bg-surface-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-semibold text-xs text-fg-2">
                              {getInitials(c.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-fg">{c.name}</p>
                              <p className="text-xs text-fg-3">
                                {formatPhone(c.phone)} · C.C. {formatDocument(c.documentId)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setCustomer(c)}
                          >
                            Seleccionar
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-sm font-medium text-fg">
                          {search ? 'No se encontraron clientes coincidentes' : 'Escribe para buscar un cliente'}
                        </p>
                        <p className="mt-1 text-xs text-fg-3">
                          O cambia a la pestaña "Nuevo Cliente" para registrarlo al instante.
                        </p>
                        {search && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="mt-3"
                            onClick={() => {
                              setCustomerMode('new');
                              setNewCustomer((prev) => ({
                                ...prev,
                                name: isNaN(Number(search)) ? search : '',
                                phone: !isNaN(Number(search)) && search.length === 10 ? search : '',
                                documentId: !isNaN(Number(search)) && search.length >= 7 ? search : '',
                              }));
                            }}
                          >
                            Crear nuevo cliente
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* Formulario de Nuevo Cliente */
              <div className="grid gap-4 rounded-2xl border border-border bg-surface-2/40 p-5 sm:grid-cols-3">
                <Field label="Nombre Completo" hint="Nombre y apellido">
                  {(id) => (
                    <Input
                      id={id}
                      required
                      placeholder="Ej. Juan Pérez"
                      minLength={2}
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, name: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Teléfono Celular" hint="10 dígitos">
                  {(id) => (
                    <Input
                      id={id}
                      type="tel"
                      required
                      placeholder="3001234567"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, phone: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Cédula de Ciudadanía" hint="Sin puntos ni espacios">
                  {(id) => (
                    <Input
                      id={id}
                      required
                      placeholder="1020304050"
                      value={newCustomer.documentId}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, documentId: e.target.value })
                      }
                    />
                  )}
                </Field>
                <p className="text-xs text-fg-3 sm:col-span-3">
                  💡 Si el número telefónico o la cédula ya existen registrados en el negocio, los datos se sincronizarán con el perfil existente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Resumen de Precios, Descuento y Pago */}
        {activeStep === 3 && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Tarjeta de Resumen / Ticket */}
              <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-3 mb-4">
                  <TagIcon className="size-4 text-accent-text" />
                  Resumen de la Reserva
                </h4>

                <div className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-fg-3">Cancha</span>
                    <span className="font-bold text-sm text-fg">
                      {selectedCourt?.court.name ?? 'Cancha'} ({SPORT_LABELS[sport] ?? sport})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fg-3">Fecha</span>
                    <span className="text-xs font-medium text-fg">
                      {formatDate(`${date}T12:00:00-05:00`)}
                    </span>
                  </div>
                  {chosen.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-fg-3">Horario</span>
                      <span className="text-xs font-bold text-accent-text">
                        {formatTime(chosen[0].start)} a {formatTime(chosen.at(-1)!.end)} ({chosen.length} turno{chosen.length > 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-xs text-fg-3">Cliente</span>
                    <span className="text-xs font-semibold text-fg">
                      {customerMode === 'search' ? customer?.name : newCustomer.name}
                    </span>
                  </div>
                </div>

                {/* Desglose de Tarifas y Descuento */}
                <div className="flex flex-col gap-3">
                  <Field label="Descuento Especial (Opcional)" hint="Se deduce del total">
                    {(id) => (
                      <div className="flex flex-col gap-2">
                        <Input
                          id={id}
                          type="number"
                          min={0}
                          step="1000"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          placeholder="0"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 10000, 20000, 50000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleQuickDiscount(val)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                                Number(discount) === val
                                  ? 'bg-accent-soft text-accent-text ring-1 ring-accent'
                                  : 'bg-surface-2 text-fg-3 hover:text-fg'
                              }`}
                            >
                              {val === 0 ? 'Sin desc.' : `-$${(val / 1000)}k`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Field>

                  <dl className="mt-2 flex flex-col gap-2 rounded-xl bg-surface-2/40 p-4 text-sm">
                    <div className="flex items-center justify-between text-fg-2">
                      <dt>Subtotal ({chosen.length} turnos)</dt>
                      <dd className="tabular font-medium">{formatMoney(subtotal, currency)}</dd>
                    </div>
                    {Number(discount) > 0 && (
                      <div className="flex items-center justify-between text-accent-text font-medium">
                        <dt>Descuento aplicado</dt>
                        <dd className="tabular">− {formatMoney(Number(discount), currency)}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold text-fg">
                      <dt>Total a Cobrar</dt>
                      <dd className="tabular text-lg text-accent-text font-extrabold">
                        {formatMoney(total, currency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Registro de Pago */}
              <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-3">
                      <CreditCardIcon className="size-4 text-accent-text" />
                      Registro de Pago
                    </h4>
                    <p className="text-xs text-fg-3 mt-0.5">
                      Registra el cobro ahora o déjalo pendiente
                    </p>
                  </div>
                  <Switch
                    checked={withPayment}
                    label="Registrar pago"
                    onChange={setWithPayment}
                  />
                </div>

                {withPayment ? (
                  <div className="flex flex-col gap-4">
                    <Field label="Monto Recibido" hint={Number(payment.amount) >= total && total > 0 ? 'Pago Total Liquidado' : 'Anticipo Registrado'}>
                      {(id) => (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Input
                              id={id}
                              type="number"
                              required
                              min={0.01}
                              step="1000"
                              value={payment.amount}
                              onChange={(e) =>
                                setPayment({ ...payment, amount: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={Number(payment.amount) === total ? 'primary' : 'secondary'}
                              onClick={() => setPayment({ ...payment, amount: String(total) })}
                            >
                              Pago Total ({formatMoney(total, currency)})
                            </Button>
                            <Button
                              size="sm"
                              variant={Number(payment.amount) === Math.round(total / 2) ? 'primary' : 'secondary'}
                              onClick={() => setPayment({ ...payment, amount: String(Math.round(total / 2)) })}
                            >
                              50% Anticipo ({formatMoney(Math.round(total / 2), currency)})
                            </Button>
                          </div>
                        </div>
                      )}
                    </Field>

                    <Field label="Método de Pago">
                      {(id) => (
                        <Select
                          id={id}
                          value={payment.method}
                          onChange={(e) =>
                            setPayment({ ...payment, method: e.target.value })
                          }
                        >
                          {catalogs.data?.paymentMethods.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>

                    {method?.requiresReference && (
                      <Field
                        label="Número de Referencia (opcional)"
                        hint={`Comprobante del pago con ${method.name}, si lo tienes`}
                      >
                        {(id) => (
                          <Input
                            id={id}
                            placeholder="Ej. # Comprobante / Aprobación"
                            value={payment.reference}
                            onChange={(e) =>
                              setPayment({ ...payment, reference: e.target.value })
                            }
                          />
                        )}
                      </Field>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
                    <p className="text-xs text-fg-3">
                      La reserva se creará en estado <strong>CONFIRMADA</strong> sin ningún pago asociado registrado.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setWithPayment(true)}
                    >
                      Registrar anticipo o pago completo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
