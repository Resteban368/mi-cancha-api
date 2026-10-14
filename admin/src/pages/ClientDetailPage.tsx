import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { StatTile } from '../components/charts/StatTile';
import { ClientCourts } from '../components/ClientCourts';
import { ArrowLeftIcon, ImageIcon, MapPinIcon } from '../components/icons';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import {
  formatCop,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  PAYMENT_CONCEPT_LABELS,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
} from '../lib/format';
import { useToast } from '../lib/toast';
import type { ClientDetail, Plan } from '../lib/types';
import { useApi } from '../lib/useApi';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useApi<ClientDetail>(`/admin/clients/${id}`);
  const plans = useApi<Plan[]>('/admin/plans');

  return (
    <>
      <Link
        to="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg"
      >
        <ArrowLeftIcon /> Clientes
      </Link>

      {client.error && <ErrorBanner message={client.error} onRetry={client.reload} />}

      {client.loading && !client.data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        client.data && (
          <ClientDetailView data={client.data} plans={plans.data ?? []} onChanged={client.reload} />
        )
      )}
    </>
  );
}

function ClientDetailView({
  data,
  plans,
  onChanged,
}: {
  data: ClientDetail;
  plans: Plan[];
  onChanged: () => void;
}) {
  const { owner, subscription, stats } = data;
  const activeCourts = data.courts.filter((c) => c.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{data.name}</h1>
        <Badge tone={subscription?.isActive ? 'success' : 'warn'}>
          {subscription ? (subscription.isActive ? 'Activo' : 'Suspendido') : 'Sin plan'}
        </Badge>
        <p className="w-full text-sm text-fg-2">
          Cliente desde el {formatDate(data.createdAt)} · perfil actualizado el{' '}
          {formatDate(data.updatedAt)}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Reservas (30 días)"
          value={formatNumber(stats.reservationsLast30Days)}
          detail={`${formatNumber(stats.reservationsTotal)} en total`}
        />
        <StatTile
          label="Próximas reservas"
          value={formatNumber(stats.upcomingReservations)}
          detail="Confirmadas desde hoy"
        />
        <StatTile
          label="Pagos aprobados (30 días)"
          value={formatCop(stats.approvedRevenueLast30Days)}
          detail="Lo que recibió el negocio"
        />
        <StatTile
          label="Pagos por validar"
          value={formatNumber(stats.pendingPayments)}
          detail="Pendientes de aprobar o rechazar"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Negocio" className="lg:col-span-2">
          <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
            <Cover url={data.imageUrl} name={data.name} />
            <dl className="grid content-start gap-4">
              <Detail label="Dirección">
                <span className="inline-flex items-start gap-1.5">
                  <span className="mt-0.5 text-fg-3">
                    <MapPinIcon width={16} height={16} />
                  </span>
                  {data.address} · {data.neighborhood}
                </span>
              </Detail>
              <Detail label="Descripción">
                {data.description ?? <span className="text-fg-3">Sin descripción</span>}
              </Detail>
              <Detail label="Servicios">
                {data.amenities.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.amenities.map((a) => (
                      <Badge key={a.code}>{a.name}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-fg-3">No ha marcado servicios</span>
                )}
              </Detail>
            </dl>
          </div>
        </Card>

        <Card title="Responsable">
          <dl className="grid gap-4 p-5">
            <Detail label="Nombre">{owner.fullName}</Detail>
            <Detail label="Email">
              {owner.email ? (
                <a href={`mailto:${owner.email}`} className="break-all text-accent hover:underline">
                  {owner.email}
                </a>
              ) : (
                '—'
              )}
            </Detail>
            <Detail label="Teléfono">
              {owner.phone ? (
                <a href={`tel:${owner.phone}`} className="text-accent hover:underline">
                  {owner.phone}
                </a>
              ) : (
                '—'
              )}
            </Detail>
            <Detail label="Cuenta">
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge tone={owner.verified ? 'success' : 'warn'}>
                  {owner.verified ? 'Verificada' : 'Sin verificar'}
                </Badge>
                <span className="text-xs text-fg-3">creada el {formatDate(owner.createdAt)}</span>
              </span>
            </Detail>
          </dl>
        </Card>
      </div>

      <SubscriptionCard
        client={data}
        plans={plans}
        activeCourts={activeCourts}
        onChanged={onChanged}
      />

      <ClientCourts
        clientId={data.id}
        courtLimit={subscription?.plan.courtLimit ?? null}
        onChanged={onChanged}
      />

      <div className="flex flex-col gap-6">
        <Card title="Últimas reservas" description="Las 10 más recientes por fecha de juego">
          {data.recentReservations.length === 0 ? (
            <EmptyState title="Sin reservas todavía" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th align="right">Valor</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentReservations.map((r) => {
                  const status = RESERVATION_STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap">
                        <p>{formatDateTime(r.start)}</p>
                        <p className="text-xs text-fg-3">
                          hasta {formatTime(r.end)} · {r.courtName}
                        </p>
                      </Td>
                      <Td>{r.customerName}</Td>
                      <Td align="right" className="tabular">
                        {formatMoney(r.totalPrice, r.currency)}
                      </Td>
                      <Td>
                        <Badge tone={status?.tone}>{status?.label ?? r.status}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Últimos pagos" description="Los 10 más recientes">
          {data.recentPayments.length === 0 ? (
            <EmptyState title="Sin pagos todavía" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th align="right">Monto</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p) => {
                  const status = PAYMENT_STATUS[p.status];
                  return (
                    <tr key={p.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(p.receivedAt)}</Td>
                      <Td>
                        <p>{p.customerName}</p>
                        <p className="text-xs text-fg-3">
                          {p.method} · {PAYMENT_CONCEPT_LABELS[p.concept] ?? p.concept}
                        </p>
                      </Td>
                      <Td align="right" className="tabular">
                        {formatCop(p.amount)}
                      </Td>
                      <Td>
                        <Badge tone={status?.tone}>{status?.label ?? p.status}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function SubscriptionCard({
  client,
  plans,
  activeCourts,
  onChanged,
}: {
  client: ClientDetail;
  plans: Plan[];
  activeCourts: number;
  onChanged: () => void;
}) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const subscription = client.subscription;

  async function update(body: { planId?: string; isActive?: boolean }) {
    setBusy(true);
    try {
      await api(`/admin/clients/${client.id}/subscription`, { method: 'PATCH', body });
      notify(
        body.isActive === undefined
          ? `Plan de ${client.name} actualizado`
          : `${client.name} ${body.isActive ? 'reactivado' : 'suspendido'}`,
      );
      onChanged();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Suscripción"
      actions={
        subscription && (
          <div className="flex items-center gap-2 text-sm text-fg-2">
            {subscription.isActive ? 'Activo' : 'Suspendido'}
            <Switch
              checked={subscription.isActive}
              disabled={busy}
              label={subscription.isActive ? 'Suspender cliente' : 'Reactivar cliente'}
              onChange={(isActive) => update({ isActive })}
            />
          </div>
        )
      }
    >
      <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Plan">
          <Select
            aria-label={`Plan de ${client.name}`}
            className="mt-1 h-9"
            value={subscription?.plan.id ?? ''}
            disabled={busy || plans.length === 0}
            onChange={(e) => update({ planId: e.target.value })}
          >
            {!subscription && <option value="">Sin plan</option>}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {formatCop(plan.monthlyPrice)}
              </option>
            ))}
          </Select>
        </Detail>
        <Detail label="Canchas en uso">
          <span className="tabular">
            {activeCourts}
            {subscription && ` de ${subscription.plan.courtLimit}`}
          </span>
        </Detail>
        <Detail label="Suscrito desde">
          {subscription ? formatDate(subscription.since) : '—'}
        </Detail>
        <Detail label="Próximo pago">
          {subscription ? (
            <>
              {formatDate(subscription.nextPayment)}
              <span className="block text-xs text-fg-3">
                {subscription.autoBilling ? 'Cobro automático' : 'Cobro manual'}
              </span>
            </>
          ) : (
            '—'
          )}
        </Detail>
      </dl>
    </Card>
  );
}

function Cover({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={`Portada de ${name}`}
        onError={() => setFailed(true)}
        className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-2 text-fg-3">
      <ImageIcon width={24} height={24} />
      <span className="text-xs">{failed ? 'No se pudo cargar la foto' : 'Sin foto de portada'}</span>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-fg-3">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}
