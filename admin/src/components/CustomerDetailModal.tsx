import { useState } from 'react';
import { StatTile } from './charts/StatTile';
import { CalendarIcon, ChevronDownIcon, CreditCardIcon, PhoneIcon } from './icons';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Modal,
  Skeleton,
  Table,
  Td,
  Th,
} from './ui';
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
import type {
  CustomerDetail,
  CustomerReservationItem,
} from '../lib/types';
import { useApi } from '../lib/useApi';

export function CustomerDetailModal({
  clientId,
  customerId,
  onClose,
}: {
  clientId: string;
  customerId: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'reservations' | 'payments'>('reservations');
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null);

  const customerApi = useApi<CustomerDetail>(
    customerId ? `/admin/clients/${clientId}/customers/${customerId}` : null,
  );

  const data = customerApi.data;

  return (
    <Modal
      open={Boolean(customerId)}
      onClose={onClose}
      size="lg"
      title={data ? data.name : 'Detalle del cliente'}
      description={
        data
          ? `Cédula / Documento: ${data.documentId} · Registrado el ${formatDate(data.createdAt)}`
          : undefined
      }
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      {customerApi.error && (
        <ErrorBanner message={customerApi.error} onRetry={customerApi.reload} />
      )}

      {customerApi.loading && !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-60" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : (
        data && (
          <div className="flex flex-col gap-5">
            {/* Cabecera rápida con datos de contacto */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-fg">
                  <PhoneIcon className="text-fg-3" />
                  <a href={`tel:${data.phone}`} className="font-medium text-accent hover:underline">
                    {data.phone}
                  </a>
                </span>
                <span className="text-fg-3">·</span>
                <span className="text-fg-2">
                  Documento: <strong className="text-fg">{data.documentId}</strong>
                </span>
              </div>
              <Badge tone="neutral">Cliente del negocio</Badge>
            </div>

            {/* Métricas resumidas */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total reservas"
                value={formatNumber(data.stats.totalReservations)}
                detail={`${data.stats.confirmedReservations + data.stats.completedReservations} efectivas · ${data.stats.cancelledReservations} canc.`}
              />
              <StatTile
                label="Total pagado"
                value={formatCop(data.stats.totalSpent)}
                detail="Pagos aprobados en la sede"
              />
              <StatTile
                label="Pagos pendientes"
                value={formatNumber(data.stats.pendingPayments)}
                detail="Por validar"
              />
              <StatTile
                label="Total devuelto"
                value={formatCop(data.stats.totalRefunded)}
                detail="Reembolsos por cancelación"
              />
            </div>

            {/* Selector de pestañas */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setTab('reservations')}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === 'reservations'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-fg-3 hover:border-border hover:text-fg'
                }`}
              >
                <CalendarIcon width={16} height={16} />
                Reservas ({data.reservations.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('payments')}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === 'payments'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-fg-3 hover:border-border hover:text-fg'
                }`}
              >
                <CreditCardIcon width={16} height={16} />
                Historial de pagos ({data.payments.length})
              </button>
            </div>

            {/* Pestaña: Reservas */}
            {tab === 'reservations' && (
              <div className="flex flex-col gap-3">
                {data.reservations.length === 0 ? (
                  <EmptyState title="Sin reservas registradas">
                    Este cliente aún no tiene reservas en este negocio.
                  </EmptyState>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Fecha y turno</Th>
                        <Th>Cancha</Th>
                        <Th align="right">Valor</Th>
                        <Th>Estado</Th>
                        <Th>
                          <span className="sr-only">Detalle</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reservations.map((r) => {
                        const status = RESERVATION_STATUS[r.status];
                        const isExpanded = expandedReservationId === r.id;
                        return (
                          <ReservationRow
                            key={r.id}
                            reservation={r}
                            status={status}
                            isExpanded={isExpanded}
                            onToggle={() =>
                              setExpandedReservationId(isExpanded ? null : r.id)
                            }
                          />
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </div>
            )}

            {/* Pestaña: Historial de Pagos */}
            {tab === 'payments' && (
              <div className="flex flex-col gap-3">
                {data.payments.length === 0 ? (
                  <EmptyState title="Sin pagos registrados">
                    Este cliente aún no tiene pagos registrados en este negocio.
                  </EmptyState>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Fecha</Th>
                        <Th>Concepto / Medio</Th>
                        <Th>Reserva asociada</Th>
                        <Th align="right">Monto</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => {
                        const status = PAYMENT_STATUS[p.status];
                        return (
                          <tr key={p.id} className="hover:bg-surface-2/40">
                            <Td className="whitespace-nowrap">
                              <p className="font-medium text-fg">{formatDateTime(p.receivedAt)}</p>
                              {p.reference && (
                                <p className="text-xs text-fg-3">Ref: {p.reference}</p>
                              )}
                            </Td>
                            <Td>
                              <p className="font-medium text-fg">
                                {PAYMENT_CONCEPT_LABELS[p.concept] ?? p.concept}
                              </p>
                              <p className="text-xs text-fg-3">{p.method}</p>
                            </Td>
                            <Td>
                              {p.courtName ? (
                                <>
                                  <p className="text-fg">{p.courtName}</p>
                                  {p.reservationStart && (
                                    <p className="text-xs text-fg-3">
                                      {formatDateTime(p.reservationStart)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <span className="text-fg-3">Pago directo</span>
                              )}
                            </Td>
                            <Td align="right" className="tabular font-medium text-fg">
                              {formatCop(p.amount)}
                            </Td>
                            <Td>
                              <Badge tone={status?.tone}>{status?.label ?? p.status}</Badge>
                              {p.rejectionReason && (
                                <p className="mt-1 text-xs text-danger">
                                  Motivo: {p.rejectionReason}
                                </p>
                              )}
                              {p.refund && (
                                <div className="mt-1 rounded bg-warn-soft px-2 py-1 text-xs text-warn">
                                  Devuelto: {formatCop(p.refund.amount)} ({p.refund.reason})
                                </div>
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </div>
            )}
          </div>
        )
      )}
    </Modal>
  );
}

function ReservationRow({
  reservation: r,
  status,
  isExpanded,
  onToggle,
}: {
  reservation: CustomerReservationItem;
  status: { tone?: 'neutral' | 'success' | 'danger' | 'warn'; label: string } | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-surface-2/40 cursor-pointer" onClick={onToggle}>
        <Td className="whitespace-nowrap">
          <p className="font-medium text-fg">{formatDateTime(r.start)}</p>
          <p className="text-xs text-fg-3">hasta {formatTime(r.end)}</p>
        </Td>
        <Td>
          <p className="font-medium text-fg">{r.courtName}</p>
          <p className="text-xs text-fg-3">{r.sport}</p>
        </Td>
        <Td align="right" className="tabular">
          <p className="font-medium text-fg">{formatMoney(r.totalPrice, r.currency)}</p>
          {r.discount > 0 && (
            <p className="text-xs text-fg-3">
              Desc: -{formatMoney(r.discount, r.currency)}
            </p>
          )}
        </Td>
        <Td>
          <Badge tone={status?.tone}>{status?.label ?? r.status}</Badge>
        </Td>
        <Td align="right">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          >
            <ChevronDownIcon
              className={`transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </Td>
      </tr>
      {isExpanded && (
        <tr className="bg-surface-2/30">
          <td colSpan={5} className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 text-xs sm:text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="font-semibold text-fg-3">Subtotal:</span>{' '}
                  <span className="text-fg">{formatMoney(r.subtotal, r.currency)}</span>
                </div>
                <div>
                  <span className="font-semibold text-fg-3">Descuento aplicado:</span>{' '}
                  <span className="text-fg">{formatMoney(r.discount, r.currency)}</span>
                </div>
                <div>
                  <span className="font-semibold text-fg-3">Total liquidado:</span>{' '}
                  <strong className="text-fg">{formatMoney(r.totalPrice, r.currency)}</strong>
                </div>
              </div>

              {r.contactNote && (
                <div className="rounded border border-border bg-surface p-2.5">
                  <span className="font-semibold text-fg-3">Nota de contacto:</span>{' '}
                  <span className="text-fg">{r.contactNote}</span>
                </div>
              )}

              {r.status === 'CANCELLED' && (
                <div className="rounded border border-danger/30 bg-danger-soft p-2.5 text-danger">
                  <p className="font-semibold">Reserva Cancelada</p>
                  <p className="mt-0.5">
                    Fecha:{' '}
                    {r.cancelledAt ? formatDateTime(r.cancelledAt) : 'No registrada'} · Por:{' '}
                    {r.cancelledByName ?? 'Negocio'}
                  </p>
                  {r.cancellationReason && (
                    <p className="mt-1">
                      <strong>Motivo:</strong> {r.cancellationReason}
                    </p>
                  )}
                </div>
              )}

              {/* Pagos vinculados a esta reserva */}
              <div>
                <h4 className="mb-1.5 font-semibold uppercase tracking-wide text-fg-3 text-[11px]">
                  Pagos registrados ({r.payments.length})
                </h4>
                {r.payments.length === 0 ? (
                  <p className="text-fg-3 italic">No hay pagos registrados para esta reserva.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {r.payments.map((p) => {
                      const pStatus = PAYMENT_STATUS[p.status];
                      return (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Badge tone={pStatus?.tone}>{pStatus?.label ?? p.status}</Badge>
                            <span className="font-medium text-fg">
                              {PAYMENT_CONCEPT_LABELS[p.concept] ?? p.concept}
                            </span>
                            <span className="text-fg-3">·</span>
                            <span className="text-fg-2">{p.method}</span>
                            {p.reference && (
                              <span className="text-fg-3">(Ref: {p.reference})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-fg-3">{formatDateTime(p.receivedAt)}</span>
                            <strong className="tabular text-fg">{formatCop(p.amount)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Devoluciones si hubo */}
              {r.refunds.length > 0 && (
                <div>
                  <h4 className="mb-1.5 font-semibold uppercase tracking-wide text-warn text-[11px]">
                    Devoluciones realizadas ({r.refunds.length})
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {r.refunds.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn"
                      >
                        <div>
                          <strong className="text-fg">{formatCop(ref.amount)}</strong> · Motivo:{' '}
                          {ref.reason}
                        </div>
                        <div className="text-fg-3">{formatDateTime(ref.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
