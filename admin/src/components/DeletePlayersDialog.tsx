import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';
import { AlertIcon } from './icons';
import { Button, Field, Input, Modal } from './ui';

const CONFIRM_WORD = 'ELIMINAR';

/** Eliminación definitiva de varios jugadores: hay que escribir ELIMINAR para confirmar. */
export function DeletePlayersDialog({
  ids,
  onClose,
  onDone,
}: {
  /** null = cerrado. */
  ids: string[] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    setTyped('');
    setError(null);
    onClose();
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ids || !matches) return;
    setError(null);
    setDeleting(true);
    try {
      const result = await api<{ deleted: number; skipped: number }>('/admin/users/delete', {
        method: 'POST',
        body: { ids },
      });
      toast(
        result.deleted === 1 ? '1 jugador eliminado' : `${result.deleted} jugadores eliminados`,
        'success',
      );
      setTyped('');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  const count = ids?.length ?? 0;
  return (
    <Modal open={ids !== null} title="Eliminar jugadores" onClose={close}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}
        <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Se eliminarán de forma definitiva <strong>{count === 1 ? '1 jugador' : `${count} jugadores`}</strong>{' '}
          con su cuenta, notificaciones y reservas en curso de la web. Las reservas ya registradas en los
          negocios se conservan, pero sin vínculo a la cuenta. No se puede deshacer.
        </div>
        <Field label={`Escribe ${CONFIRM_WORD} para confirmar`}>
          {(id) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={close} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={!matches || deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
