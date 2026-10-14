import { useState, type FormEvent } from 'react';
import { PlusIcon, SearchIcon } from '../components/icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
} from '../components/ui';
import { useToast } from '../lib/toast';
import { api, errorMessage } from '../lib/api';
import { formatCop, formatDate } from '../lib/format';
import type { Client, Page, Plan } from '../lib/types';
import { useApi, useDebounced } from '../lib/useApi';

const PAGE_SIZE = 20;

export function ClientsPage() {
  const notify = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch) query.set('search', debouncedSearch);
  const clients = useApi<Page<Client>>(`/admin/clients?${query}`);
  const plans = useApi<Plan[]>('/admin/plans');

  async function updateSubscription(client: Client, body: { planId?: string; isActive?: boolean }) {
    setBusyId(client.id);
    try {
      await api(`/admin/clients/${client.id}/subscription`, { method: 'PATCH', body });
      notify(
        body.isActive === undefined
          ? `Plan de ${client.name} actualizado`
          : `${client.name} ${body.isActive ? 'reactivado' : 'suspendido'}`,
      );
      clients.reload();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Negocios que usan Mi Cancha, su plan y su estado."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PlusIcon /> Nuevo cliente
          </Button>
        }
      />

      <Card>
        <div className="border-b border-border p-4">
          <label className="relative block max-w-sm">
            <span className="sr-only">Buscar clientes</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">
              <SearchIcon />
            </span>
            <Input
              className="pl-9"
              placeholder="Buscar por negocio, responsable, email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        {clients.error && (
          <div className="p-4">
            <ErrorBanner message={clients.error} onRetry={clients.reload} />
          </div>
        )}

        {clients.loading && !clients.data ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : clients.data && clients.data.items.length === 0 ? (
          <EmptyState title={debouncedSearch ? 'Sin resultados' : 'Aún no hay clientes'}>
            {debouncedSearch
              ? `Ningún cliente coincide con “${debouncedSearch}”.`
              : 'Crea el primero con “Nuevo cliente”.'}
          </EmptyState>
        ) : (
          clients.data && (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Negocio</Th>
                    <Th>Responsable</Th>
                    <Th>Plan</Th>
                    <Th align="right">Canchas</Th>
                    <Th>Estado</Th>
                    <Th>Alta</Th>
                  </tr>
                </thead>
                <tbody>
                  {clients.data.items.map((client) => (
                    <tr key={client.id}>
                      <Td>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-fg-3">{client.neighborhood}</p>
                      </Td>
                      <Td>
                        <p>{client.owner.fullName}</p>
                        <p className="text-xs text-fg-3">
                          {[client.owner.email, client.owner.phone].filter(Boolean).join(' · ')}
                        </p>
                      </Td>
                      <Td>
                        <Select
                          aria-label={`Plan de ${client.name}`}
                          className="h-9 min-w-48"
                          value={client.plan?.id ?? ''}
                          disabled={busyId === client.id || !plans.data}
                          onChange={(e) => updateSubscription(client, { planId: e.target.value })}
                        >
                          {!client.plan && <option value="">Sin plan</option>}
                          {plans.data?.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · {formatCop(plan.monthlyPrice)}
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td align="right" className="tabular">
                        {client.activeCourts}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={client.subscriptionActive}
                            disabled={busyId === client.id || !client.plan}
                            label={client.subscriptionActive ? 'Suspender cliente' : 'Reactivar cliente'}
                            onChange={(isActive) => updateSubscription(client, { isActive })}
                          />
                          <Badge tone={client.subscriptionActive ? 'success' : 'warn'}>
                            {client.subscriptionActive ? 'Activo' : 'Suspendido'}
                          </Badge>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-fg-2">{formatDate(client.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={clients.data.page}
                pageSize={clients.data.pageSize}
                total={clients.data.total}
                onChange={setPage}
              />
            </>
          )
        )}
      </Card>

      <CreateClientModal
        open={creating}
        plans={plans.data ?? []}
        onClose={() => setCreating(false)}
        onCreated={(client) => {
          setCreating(false);
          notify(`Cliente ${client.name} creado. Comparte el email y la contraseña con el negocio.`);
          setSearch('');
          setPage(1);
          clients.reload();
        }}
      />
    </>
  );
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  businessName: '',
  address: '',
  neighborhood: '',
  planId: '',
};

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function CreateClientModal({
  open,
  plans,
  onClose,
  onCreated,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function close() {
    setForm(EMPTY_FORM);
    setError(undefined);
    onClose();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const client = await api<Client>('/admin/clients', {
        method: 'POST',
        body: {
          ...form,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          planId: form.planId || plans[0]?.id,
        },
      });
      setForm(EMPTY_FORM);
      onCreated(client);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Nuevo cliente"
      description="Crea el usuario del negocio, su negocio y le asigna un plan."
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          <Button type="submit" form="create-client" variant="primary" loading={saving}>
            Crear cliente
          </Button>
        </>
      }
    >
      <form id="create-client" onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <ErrorBanner message={error} />}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-3">
            Usuario del negocio
          </legend>
          <Field label="Nombre completo">
            {(id) => <Input id={id} required minLength={2} value={form.fullName} onChange={(e) => set('fullName')(e.target.value)} />}
          </Field>
          <Field label="Teléfono" hint="Opcional">
            {(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} />}
          </Field>
          <Field label="Email">
            {(id) => <Input id={id} type="email" required autoComplete="off" value={form.email} onChange={(e) => set('email')(e.target.value)} />}
          </Field>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password')(e.target.value)} />
                <Button size="md" onClick={() => set('password')(generatePassword())}>
                  Generar
                </Button>
              </div>
            )}
          </Field>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-3">Negocio</legend>
          <Field label="Nombre del negocio">
            {(id) => <Input id={id} required minLength={2} value={form.businessName} onChange={(e) => set('businessName')(e.target.value)} />}
          </Field>
          <Field label="Plan">
            {(id) => (
              <Select id={id} required value={form.planId || plans[0]?.id || ''} onChange={(e) => set('planId')(e.target.value)}>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {formatCop(plan.monthlyPrice)}/mes · {plan.courtLimit} cancha(s)
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Dirección">
            {(id) => <Input id={id} required minLength={3} value={form.address} onChange={(e) => set('address')(e.target.value)} />}
          </Field>
          <Field label="Barrio">
            {(id) => <Input id={id} required minLength={2} value={form.neighborhood} onChange={(e) => set('neighborhood')(e.target.value)} />}
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
