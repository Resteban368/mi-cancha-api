import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, formatMoney, PAYMENT_CONCEPT_LABELS } from '../lib/format';
import { useToast } from '../lib/toast';
import type { Refund } from '../lib/types';
import { useApi } from '../lib/useApi';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, Skeleton, Table, Td, Th } from './ui';

/** Pide el motivo y cancela la reserva; los pagos aprobados pasan a devoluciones. */
export function CancelReservationModal({
  clientId,
  reservation,
  onClose,
  onCancelled,
}: {
  clientId: string;
  reservation: { id: string; start: string; courtName: string; customerName: string };
  onClose: () => void;
  onCancelled: () => void;
}) {
  const notify = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api(`/admin/clients/${clientId}/reservations/${reservation.id}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() },
      });
      notify('Reserva cancelada: el turno quedó libre');
      onCancelled();
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
      title="Cancelar reserva"
      description={`${reservation.customerName} · ${reservation.courtName} · ${formatDateTime(reservation.start)}`}
      footer={
        <>
          <Button onClick={onClose}>Volver</Button>
          <Button type="submit" form="cancel-reservation" variant="danger" loading={saving}>
            Cancelar reserva
          </Button>
        </>
      }
    >
      <form id="cancel-reservation" onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Motivo de la cancelación" hint="Entre 3 y 200 caracteres">
          {(id) => (
            <Input
              id={id}
              required
              minLength={3}
              maxLength={200}
              placeholder="p. ej. El cliente avisó que no puede asistir"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
        <p className="text-sm text-fg-2">
          El turno queda libre de inmediato. Los pagos aprobados de esta reserva se marcan como
          devueltos y quedan en Devoluciones; los pendientes se rechazan.
        </p>
      </form>
    </Modal>
  );
}

export function RefundsCard({ clientId, version }: { clientId: string; version: number }) {
  const refunds = useApi<Refund[]>(`/admin/clients/${clientId}/refunds?v=${version}`);
  return (
    <Card title="Devoluciones" description="Pagos devueltos al cancelar reservas">
      {refunds.error && (
        <div className="p-4">
          <ErrorBanner message={refunds.error} onRetry={refunds.reload} />
        </div>
      )}
      {refunds.loading && !refunds.data ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : !refunds.data?.length ? (
        <EmptyState title="Sin devoluciones" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>Reserva</Th>
              <Th>Motivo</Th>
              <Th align="right">Monto</Th>
            </tr>
          </thead>
          <tbody>
            {refunds.data.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">
                  <p>{formatDateTime(r.createdAt)}</p>
                  <p className="text-xs text-fg-3">{r.createdBy ? `por ${r.createdBy}` : ''}</p>
                </Td>
                <Td>
                  <p>{r.customer?.name ?? '—'}</p>
                  {r.customer && (
                    <p className="text-xs text-fg-3">
                      C.C. {r.customer.documentId} · {r.customer.phone}
                    </p>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  <p>{r.reservation.courtName}</p>
                  <p className="text-xs text-fg-3">{formatDateTime(r.reservation.start)}</p>
                </Td>
                <Td>
                  <p>{r.reason}</p>
                  <p className="text-xs text-fg-3">
                    {r.payment.methodName} · {PAYMENT_CONCEPT_LABELS[r.payment.concept] ?? r.payment.concept}
                  </p>
                </Td>
                <Td align="right" className="tabular">
                  {formatMoney(r.amount, r.currency)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
