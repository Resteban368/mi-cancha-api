import { useState, type FormEvent } from 'react';
import { CheckIcon, CloseIcon, PlusIcon } from '../components/icons';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Skeleton,
} from '../components/ui';
import { useToast } from '../lib/toast';
import { api, errorMessage } from '../lib/api';
import { formatCop } from '../lib/format';
import type { BillingSettings, Plan, PlanBenefit } from '../lib/types';
import { useApi } from '../lib/useApi';

export function PlansPage() {
  const notify = useToast();
  const plans = useApi<Plan[]>('/admin/plans');
  const billing = useApi<BillingSettings>('/admin/billing-settings');
  const [editingModulePrice, setEditingModulePrice] = useState(false);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [editingPrices, setEditingPrices] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api(`/admin/plans/${deleting.id}`, { method: 'DELETE' });
      notify(`Plan ${deleting.name} eliminado`);
      setDeleting(null);
      plans.reload();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Planes"
        description="Suscripciones que pagan los negocios. El límite de canchas se aplica al crear canchas."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon /> Nuevo plan
          </Button>
        }
      />
      {plans.error && <ErrorBanner message={plans.error} onRetry={plans.reload} />}
      {billing.error && <ErrorBanner message={billing.error} onRetry={billing.reload} />}
      {billing.data && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5">
          <div>
            <h2 className="font-semibold">Módulo Ventas e inventario</h2>
            <p className="mt-1 text-sm text-fg-2">
              <span className="tabular font-medium text-fg">
                {billing.data.salesModulePrice > 0 ? `${formatCop(billing.data.salesModulePrice)}/mes` : 'Sin precio'}
              </span>
              {' · '}
              {billing.data.salesModuleClients} {billing.data.salesModuleClients === 1 ? 'cliente' : 'clientes'} con el módulo activo. Se suma solo a planes de pago.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditingModulePrice(true)}>
            Editar precio
          </Button>
        </section>
      )}

      {plans.loading && !plans.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : plans.data?.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title="No hay planes">Crea uno para poder dar de alta clientes.</EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data?.map((plan) => (
            <article key={plan.id} className="flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-fg-2">
                  {plan.subscriptions} {plan.subscriptions === 1 ? 'cliente' : 'clientes'}
                </span>
              </div>
              <p className="mt-3">
                <span className="tabular text-3xl font-semibold tracking-tight">
                  {plan.monthlyPrice === 0 ? 'Gratis' : formatCop(plan.monthlyPrice)}
                </span>
                {plan.pricedByCourts && <span className="text-sm text-fg-3"> desde</span>}
                {plan.monthlyPrice > 0 && <span className="text-sm text-fg-3"> /mes</span>}
              </p>
              <p className="mt-1 text-sm text-fg-2">
                {plan.pricedByCourts ? 'Precio según canchas contratadas, hasta ' : 'Hasta '}
                {plan.courtLimit} {plan.courtLimit === 1 ? 'cancha activa' : 'canchas activas'}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 border-t border-border pt-4 text-sm">
                {plan.benefits.length === 0 && <li className="text-fg-3">Sin beneficios descritos</li>}
                {plan.benefits.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-accent-text">
                      <CheckIcon />
                    </span>
                    <span>
                      <span className="font-medium">{b.title}</span>
                      {b.detail && <span className="block text-fg-3">{b.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {plan.pricedByCourts && (
                <details className="mt-4 border-t border-border pt-4 text-sm">
                  <summary className="cursor-pointer font-medium">Tabla de precios</summary>
                  <ul className="tabular mt-2 flex flex-col gap-1 text-fg-2">
                    {plan.courtPrices.map((row) => (
                      <li key={row.courts} className="flex justify-between">
                        <span>{row.courts === 1 ? '1 cancha' : `${row.courts} canchas`}</span>
                        <span>{formatCop(row.monthlyPrice)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-5 flex gap-2">
                <Button size="sm" onClick={() => setEditing(plan)}>
                  Editar
                </Button>
                {plan.pricedByCourts && (
                  <Button size="sm" onClick={() => setEditingPrices(plan)}>
                    Editar precios
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={plan.pricedByCourts || plan.subscriptions > 0}
                  title={
                    plan.pricedByCourts
                      ? 'Es el plan principal'
                      : plan.subscriptions > 0
                        ? 'Tiene clientes: cámbialos de plan antes de eliminarlo'
                        : undefined
                  }
                  onClick={() => setDeleting(plan)}
                >
                  Eliminar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <PlanModal
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(plan, created) => {
            setEditing(null);
            notify(created ? `Plan ${plan.name} creado` : `Plan ${plan.name} actualizado`);
            plans.reload();
          }}
        />
      )}

      {editingModulePrice && billing.data && (
        <ModulePriceModal
          settings={billing.data}
          onClose={() => setEditingModulePrice(false)}
          onSaved={() => {
            setEditingModulePrice(false);
            notify('Precio del módulo actualizado');
            billing.reload();
          }}
        />
      )}

      {editingPrices && (
        <CourtPricesModal
          plan={editingPrices}
          onClose={() => setEditingPrices(null)}
          onSaved={() => {
            setEditingPrices(null);
            notify('Precios actualizados');
            plans.reload();
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`¿Eliminar el plan ${deleting?.name ?? ''}?`}
        description="Esta acción no se puede deshacer."
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" loading={deletingBusy} onClick={confirmDelete}>
              Eliminar plan
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-2">El plan dejará de estar disponible para nuevos clientes.</p>
      </Modal>
    </>
  );
}

function ModulePriceModal({
  settings,
  onClose,
  onSaved,
}: {
  settings: BillingSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(settings.salesModulePrice));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api('/admin/billing-settings', { method: 'PATCH', body: { salesModulePrice: Number(price) } });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Precio de Ventas e inventario"
      description={`Se aplica de inmediato a ${settings.salesModuleClients} cliente(s) con el módulo activo, al ingreso mensual del panel y a la landing. Los términos prometen avisar a los clientes con 30 días de anticipación.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="module-price-form" variant="primary" loading={saving} disabled={Number(price) === settings.salesModulePrice}>
            Guardar precio
          </Button>
        </>
      }
    >
      <form id="module-price-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Precio mensual (COP)" hint="0 = sin precio: no se cobra y la landing dice «Consultar precio»">
          {(id) => (
            <Input id={id} type="number" required min={0} max={100_000_000} step={1} inputMode="numeric" className="tabular" value={price} onChange={(e) => setPrice(e.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function CourtPricesModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prices, setPrices] = useState(() => plan.courtPrices.map((row) => String(row.monthlyPrice)));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const changed = prices.filter((price, i) => Number(price) !== plan.courtPrices[i].monthlyPrice).length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api(`/admin/plans/${plan.id}`, {
        method: 'PATCH',
        body: { courtPrices: prices.map(Number) },
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar precios por canchas"
      description={`Se aplican de inmediato a ${plan.subscriptions} cliente(s), al ingreso mensual del panel y a la landing. Los términos prometen avisar a los clientes con 30 días de anticipación.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="court-prices-form" variant="primary" loading={saving} disabled={changed === 0}>
            {changed === 0 ? 'Sin cambios' : `Guardar ${changed} ${changed === 1 ? 'precio' : 'precios'}`}
          </Button>
        </>
      }
    >
      <form id="court-prices-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {plan.courtPrices.map((row, i) => (
            <Field key={row.courts} label={row.courts === 1 ? '1 cancha' : `${row.courts} canchas`}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  required
                  min={1}
                  max={100_000_000}
                  step={1}
                  inputMode="numeric"
                  className="tabular"
                  value={prices[i]}
                  onChange={(e) => setPrices((list) => list.map((p, j) => (j === i ? e.target.value : p)))}
                />
              )}
            </Field>
          ))}
        </div>
      </form>
    </Modal>
  );
}

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: (plan: Plan, created: boolean) => void;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan?.monthlyPrice ?? ''));
  const [courtLimit, setCourtLimit] = useState(String(plan?.courtLimit ?? '1'));
  const [benefits, setBenefits] = useState<PlanBenefit[]>(plan?.benefits ?? []);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const updateBenefit = (index: number, patch: Partial<PlanBenefit>) =>
    setBenefits((list) => list.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const body = {
      name: name.trim(),
      // En el plan por canchas, precio y límite salen de la tabla.
      ...(plan?.pricedByCourts
        ? {}
        : { monthlyPrice: Number(monthlyPrice), courtLimit: Number(courtLimit) }),
      benefits: benefits
        .map((b) => ({ title: b.title.trim(), detail: b.detail.trim() }))
        .filter((b) => b.title),
    };
    try {
      const saved = plan
        ? await api<Plan>(`/admin/plans/${plan.id}`, { method: 'PATCH', body })
        : await api<Plan>('/admin/plans', { method: 'POST', body });
      onSaved(saved, !plan);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={plan ? `Editar plan ${plan.name}` : 'Nuevo plan'}
      description={plan && plan.subscriptions > 0 ? `Los cambios afectan a ${plan.subscriptions} cliente(s).` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="plan-form" variant="primary" loading={saving}>
            {plan ? 'Guardar cambios' : 'Crear plan'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre">
            {(id) => <Input id={id} required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          {!plan?.pricedByCourts && (
            <>
              <Field label="Precio mensual (COP)" hint="0 = plan gratuito">
                {(id) => (
                  <Input id={id} type="number" required min={0} step={1000} inputMode="numeric" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
                )}
              </Field>
              <Field label="Canchas activas">
                {(id) => (
                  <Input id={id} type="number" required min={1} max={500} inputMode="numeric" value={courtLimit} onChange={(e) => setCourtLimit(e.target.value)} />
                )}
              </Field>
            </>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Beneficios</p>
            <Button size="sm" variant="ghost" onClick={() => setBenefits((l) => [...l, { title: '', detail: '' }])}>
              <PlusIcon /> Agregar
            </Button>
          </div>
          {benefits.length === 0 && <p className="text-sm text-fg-3">Sin beneficios. Se muestran a los negocios en la app.</p>}
          <ul className="flex flex-col gap-2">
            {benefits.map((b, i) => (
              <li key={i} className="flex gap-2">
                <Input aria-label={`Título del beneficio ${i + 1}`} placeholder="Título" className="sm:w-48" value={b.title} maxLength={60} onChange={(e) => updateBenefit(i, { title: e.target.value })} />
                <Input aria-label={`Detalle del beneficio ${i + 1}`} placeholder="Detalle" value={b.detail} maxLength={200} onChange={(e) => updateBenefit(i, { detail: e.target.value })} />
                <Button variant="ghost" aria-label={`Quitar beneficio ${i + 1}`} onClick={() => setBenefits((l) => l.filter((_, j) => j !== i))}>
                  <CloseIcon />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </Modal>
  );
}
