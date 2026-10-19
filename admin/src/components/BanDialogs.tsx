import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatDate, ROLE_LABELS } from '../lib/format';
import type { BanFields, BanPreview, BanResult, UserRole } from '../lib/security-types';
import { useToast } from '../lib/toast';
import { useApi } from '../lib/useApi';
import { Button, ErrorBanner, Field, Modal, Skeleton } from './ui';

export interface BanTarget extends Partial<BanFields> {
  id: string;
  displayName: string;
  role: UserRole;
}

/** Bloquear una cuenta: motivo obligatorio y, si el admin quiere, cancelar sus reservas futuras. */
export function BanUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: BanTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title="Bloquear cuenta"
      description="La persona no podrá ingresar y su sesión actual se cierra."
    >
      {/* Se monta de nuevo por cada usuario, así el formulario siempre empieza limpio. */}
      {user && <BanForm key={user.id} user={user} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function BanForm({ user, onClose, onDone }: { user: BanTarget; onClose: () => void; onDone: () => void }) {
  const notify = useToast();
  const preview = useApi<BanPreview>(`/admin/users/${user.id}/ban-preview`);
  const [reason, setReason] = useState('');
  // Si hay reservas por cancelar, queda marcado: el admin lo ve y puede desmarcarlo.
  const [cancel, setCancel] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const future = preview.data?.futureReservations ?? 0;
  const cancelChecked = cancel ?? future > 0;
  const isBusiness = user.role === 'ADMIN_NEGOCIO';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const result = await api<BanResult>(`/admin/users/${user.id}/ban`, {
        method: 'POST',
        body: { reason: reason.trim(), cancelFutureReservations: cancelChecked && future > 0 },
      });
      notify(banMessage(result));
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}
      <p className="text-sm">
        <span className="font-semibold">{user.displayName}</span>{' '}
        <span className="text-fg-3">· {ROLE_LABELS[user.role]}</span>
        {preview.data?.businessName && <span className="text-fg-3"> · {preview.data.businessName}</span>}
      </p>

      <Field label="Motivo" hint="Queda en la auditoría. Mínimo 3 caracteres.">
        {(id) => (
          <textarea
            id={id}
            required
            minLength={3}
            maxLength={300}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            placeholder="Por qué se bloquea esta cuenta"
          />
        )}
      </Field>

      {preview.error ? (
        <ErrorBanner message={preview.error} onRetry={preview.reload} />
      ) : !preview.data ? (
        <Skeleton className="h-14" />
      ) : (
        <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            checked={cancelChecked && future > 0}
            disabled={future === 0}
            onChange={(e) => setCancel(e.target.checked)}
          />
          <span>
            <span className="font-medium">
              {future === 0
                ? 'No tiene reservas futuras por cancelar'
                : `Cancelar ${future} ${future === 1 ? 'reserva futura' : 'reservas futuras'}`}
            </span>
            {future > 0 && (
              <span className="mt-0.5 block text-fg-3">
                {isBusiness
                  ? 'Son las reservas de los jugadores en su negocio. Se avisa el motivo y se procesan las devoluciones de pagos aprobados.'
                  : 'Se libera el turno y se procesan las devoluciones de pagos aprobados.'}
              </span>
            )}
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="danger" loading={saving} disabled={!preview.data}>
          Bloquear cuenta
        </Button>
      </div>
    </form>
  );
}

function banMessage(result: BanResult): string {
  const base = 'Cuenta bloqueada';
  if (result.failedCancellations > 0) {
    return `${base}. ${result.failedCancellations} reservas no se pudieron cancelar: revísalas a mano.`;
  }
  if (result.cancelledReservations > 0) {
    return `${base} · ${result.cancelledReservations} ${result.cancelledReservations === 1 ? 'reserva cancelada' : 'reservas canceladas'}`;
  }
  return base;
}

/** Desbloquear: confirma mostrando el motivo con el que se bloqueó. */
export function UnbanUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: BanTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const notify = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    if (!user) return;
    setSaving(true);
    setError(undefined);
    try {
      await api(`/admin/users/${user.id}/ban`, { method: 'DELETE' });
      notify('Cuenta desbloqueada');
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title="Desbloquear cuenta"
      description="Podrá volver a ingresar con sus datos de siempre."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={confirm}>
            Desbloquear
          </Button>
        </>
      }
    >
      {error && <ErrorBanner message={error} />}
      {user && (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <span className="font-semibold">{user.displayName}</span>{' '}
            <span className="text-fg-3">· {ROLE_LABELS[user.role]}</span>
          </p>
          {user.bannedReason && (
            <p className="text-fg-2">
              Bloqueada{user.bannedAt ? ` el ${formatDate(user.bannedAt)}` : ''} por: {user.bannedReason}
            </p>
          )}
          <p className="text-fg-3">Las reservas que se cancelaron al bloquear no se restauran.</p>
        </div>
      )}
    </Modal>
  );
}
