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
import type { Plan, PlanBenefit } from '../lib/types';
import { useApi } from '../lib/useApi';

export function PlansPage() {
  const notify = useToast();
  const plans = useApi<Plan[]>('/admin/plans');
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
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
                {plan.monthlyPrice > 0 && <span className="text-sm text-fg-3"> /mes</span>}
              </p>
              <p className="mt-1 text-sm text-fg-2">
                Hasta {plan.courtLimit} {plan.courtLimit === 1 ? 'cancha activa' : 'canchas activas'}
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
              <div className="mt-5 flex gap-2">
                <Button size="sm" onClick={() => setEditing(plan)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={plan.subscriptions > 0}
                  title={plan.subscriptions > 0 ? 'Tiene clientes: cámbialos de plan antes de eliminarlo' : undefined}
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
      monthlyPrice: Number(monthlyPrice),
      courtLimit: Number(courtLimit),
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
