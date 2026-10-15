import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import {
  CUSTOMER_LEVELS,
  formatShortDate,
  formatDocument,
  formatMoney,
  formatNumber,
  formatPhone,
  SPORT_LABELS,
} from '../lib/format';
import { useToast } from '../lib/toast';
import type {
  Customer,
  CustomerPage,
  CustomerSegment,
  CustomerSort,
  CustomerSummary,
  Sport,
} from '../lib/types';
import { useApi, useDebounced } from '../lib/useApi';
import { StatTile } from './charts/StatTile';
import { CustomerDetailModal } from './CustomerDetailModal';
import { EditIcon, HistoryIcon, PlusIcon, SearchIcon } from './icons';
import { NewReservationModal } from './NewReservation';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
} from './ui';

const PAGE_SIZE = 10;
const SPORTS: Sport[] = ['FUTBOL', 'PADEL', 'BALONCESTO', 'VOLEIBOL'];

const SEGMENTS: { value: CustomerSegment; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'LOYAL', label: 'VIP / Frecuentes' },
  { value: 'WITH_BALANCE', label: 'Con saldo pendiente' },
  { value: 'NEW', label: 'Nuevos' },
];

const SORTS: { value: CustomerSort; label: string }[] = [
  { value: 'MOST_RESERVATIONS', label: 'Más reservas' },
  { value: 'TOP_SPENDERS', label: 'Mayor inversión' },
  { value: 'LAST_VISIT', label: 'Última visita' },
  { value: 'HIGHEST_BALANCE', label: 'Mayor saldo' },
  { value: 'NAME', label: 'Nombre (A–Z)' },
  { value: 'NEWEST', label: 'Más recientes' },
];

/** Cartera de clientes (personas) del negocio, con métricas de fidelidad. */
export function ClientCustomers({
  clientId,
  onChanged,
}: {
  clientId: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('ALL');
  const [sort, setSort] = useState<CustomerSort>('MOST_RESERVATIONS');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [booking, setBooking] = useState<Customer | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    segment,
    sort,
  });
  if (debouncedSearch) query.set('search', debouncedSearch);
  const customers = useApi<CustomerPage>(
    `/admin/clients/${clientId}/customers?${query}`,
  );
  const overview = customers.data?.overview;

  return (
    <>
      <Card
        title="Clientes"
        description="Directorio de jugadores, fidelidad y contacto directo"
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            <PlusIcon /> Nuevo cliente
          </Button>
        }
      >
        {overview && (
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total clientes"
              value={formatNumber(overview.totalCustomers)}
              detail={
                overview.newVsLastMonthPct === null
                  ? `${overview.newThisMonth} nuevos este mes`
                  : `${overview.newVsLastMonthPct >= 0 ? '+' : ''}${overview.newVsLastMonthPct}% nuevos vs mes anterior`
              }
            />
            <StatTile
              label="Frecuentes / VIP"
              value={formatNumber(overview.loyalCustomers)}
              detail={`${overview.loyalPct}% de la cartera · 5 o más reservas`}
            />
            <StatTile
              label="Reservas acumuladas"
              value={formatNumber(overview.totalReservations)}
              detail="Sin contar las canceladas"
            />
            <StatTile
              label="Saldo por cobrar"
              value={formatMoney(overview.pendingBalance, overview.currency)}
              detail="De reservas confirmadas y jugadas"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-3">
            <label className="relative block min-w-56 flex-1">
              <span className="sr-only">Buscar clientes</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">
                <SearchIcon />
              </span>
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, cédula o teléfono…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <div className="w-full sm:w-52">
              <Select
                aria-label="Ordenar clientes"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as CustomerSort);
                  setPage(1);
                }}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar clientes"
            >
              {SEGMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={segment === s.value}
                  onClick={() => {
                    setSegment(s.value);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    segment === s.value
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border text-fg-2 hover:bg-surface-2'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {customers.data && overview && (
              <span className="text-sm text-fg-3">
                Mostrando {customers.data.total} de {overview.totalCustomers}{' '}
                clientes
              </span>
            )}
          </div>
        </div>

        {customers.error && (
          <div className="p-4">
            <ErrorBanner message={customers.error} onRetry={customers.reload} />
          </div>
        )}

        {customers.loading && !customers.data ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : customers.data && customers.data.items.length === 0 ? (
          <EmptyState
            title={
              debouncedSearch || segment !== 'ALL'
                ? 'Sin resultados'
                : 'Sin clientes registrados'
            }
          >
            {debouncedSearch || segment !== 'ALL'
              ? 'Ningún cliente cumple la búsqueda o el filtro.'
              : 'Las personas que reserven en este negocio aparecerán aquí.'}
          </EmptyState>
        ) : (
          customers.data && (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Jugador / documento</Th>
                    <Th>Contacto</Th>
                    <Th>Nivel</Th>
                    <Th>Reservas / asistencia</Th>
                    <Th align="right">Total invertido</Th>
                    <Th>Última visita</Th>
                    <Th>
                      <span className="sr-only">Acciones</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {customers.data.items.map((c) => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onDetail={() => setDetailId(c.id)}
                      onEdit={() => setEditing(c)}
                      onBook={() => setBooking(c)}
                    />
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={customers.data.page}
                pageSize={customers.data.pageSize}
                total={customers.data.total}
                onChange={setPage}
              />
            </>
          )
        )}
      </Card>

      {detailId && (
        <CustomerDetailModal
          clientId={clientId}
          customerId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
      {editing && (
        <CustomerFormModal
          clientId={clientId}
          customer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            customers.reload();
          }}
        />
      )}
      {booking && (
        <NewReservationModal
          clientId={clientId}
          initialCustomer={booking}
          onClose={() => setBooking(null)}
          onCreated={() => {
            setBooking(null);
            customers.reload();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function CustomerRow({
  customer: c,
  onDetail,
  onEdit,
  onBook,
}: {
  customer: CustomerSummary;
  onDetail: () => void;
  onEdit: () => void;
  onBook: () => void;
}) {
  const level = CUSTOMER_LEVELS[c.metrics.level];
  const whatsapp = c.phone.replace(/\D/g, '');
  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <tr>
      <Td>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {initials}
          </span>
          <div>
            <button
              type="button"
              onClick={onDetail}
              className="whitespace-nowrap text-left font-medium hover:text-accent hover:underline"
            >
              {c.name}
            </button>
            <p className="whitespace-nowrap text-xs text-fg-3">
              C.C. {formatDocument(c.documentId)}
            </p>
          </div>
        </div>
      </Td>
      <Td className="whitespace-nowrap">
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className="text-fg-2 hover:text-accent hover:underline"
          title="Abrir WhatsApp"
        >
          {formatPhone(c.phone)}
        </a>
        {c.metrics.favoriteSport && (
          <p className="text-xs text-fg-3">
            {SPORT_LABELS[c.metrics.favoriteSport]}
          </p>
        )}
      </Td>
      <Td>
        <Badge tone={level.tone}>{level.label}</Badge>
      </Td>
      <Td className="whitespace-nowrap">
        <p className="tabular">
          {c.metrics.reservations} reserva
          {c.metrics.reservations === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-fg-3">
          {c.metrics.attendancePct === null
            ? 'Aún sin jugar'
            : `${c.metrics.attendancePct}% asistencia`}
        </p>
      </Td>
      <Td align="right" className="whitespace-nowrap">
        <p className="tabular font-medium">
          {formatMoney(c.metrics.totalSpent, 'COP')}
        </p>
        {c.metrics.balance > 0 && (
          <Badge tone="danger">
            Debe {formatMoney(c.metrics.balance, 'COP')}
          </Badge>
        )}
      </Td>
      <Td className="whitespace-nowrap">
        {c.metrics.lastVisit ? (
          <>
            <p>{formatShortDate(c.metrics.lastVisit.date)}</p>
            <p className="text-xs text-fg-3">{c.metrics.lastVisit.courtName}</p>
          </>
        ) : (
          <span className="text-fg-3">—</span>
        )}
      </Td>
      <Td align="right">
        <div className="flex justify-end gap-0.5 whitespace-nowrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDetail}
            title="Historial de reservas y pagos"
            aria-label={`Historial de ${c.name}`}
          >
            <HistoryIcon />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            title="Editar cliente"
            aria-label={`Editar a ${c.name}`}
          >
            <EditIcon />
          </Button>
          <Button size="sm" variant="primary" onClick={onBook}>
            Reservar
          </Button>
        </div>
      </Td>
    </tr>
  );
}

function CustomerFormModal({
  clientId,
  customer,
  onClose,
  onSaved,
}: {
  clientId: string;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer ? formatPhone(customer.phone) : '',
    documentId: customer?.documentId ?? '',
    preferredSport: customer?.preferredSport ?? '',
    notes: customer?.notes ?? '',
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const body = {
      name: form.name.trim(),
      phone: form.phone,
      documentId: form.documentId,
      preferredSport: form.preferredSport || null,
      notes: form.notes.trim() || null,
    };
    try {
      await api(
        customer
          ? `/admin/clients/${clientId}/customers/${customer.id}`
          : `/admin/clients/${clientId}/customers`,
        { method: customer ? 'PATCH' : 'POST', body },
      );
      notify(
        customer
          ? `Cliente ${body.name} actualizado`
          : `Cliente ${body.name} registrado`,
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? 'Editar cliente' : 'Nuevo cliente'}
      description="El nivel de fidelidad se calcula solo con sus reservas."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            form="customer-form"
            variant="primary"
            loading={saving}
          >
            {customer ? 'Guardar cambios' : 'Registrar cliente'}
          </Button>
        </>
      }
    >
      <form
        id="customer-form"
        onSubmit={onSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        {error && (
          <div className="sm:col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Nombre completo">
            {(id) => (
              <Input
                id={id}
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label="Teléfono / WhatsApp" hint="10 dígitos se guardan con +57">
          {(id) => (
            <Input
              id={id}
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          )}
        </Field>
        <Field label="Cédula">
          {(id) => (
            <Input
              id={id}
              required
              value={form.documentId}
              onChange={(e) => setForm({ ...form, documentId: e.target.value })}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Deporte habitual"
            hint="Si lo dejas automático, se usa el que más reserva"
          >
            {(id) => (
              <Select
                id={id}
                value={form.preferredSport}
                onChange={(e) =>
                  setForm({ ...form, preferredSport: e.target.value })
                }
              >
                <option value="">Automático</option>
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {SPORT_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notas internas" hint="Solo las ve el negocio">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
