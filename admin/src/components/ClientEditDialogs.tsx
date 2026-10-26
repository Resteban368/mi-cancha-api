import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';
import type { ClientDetail } from '../lib/types';
import { CityPicker } from './CityPicker';
import { AlertIcon } from './icons';
import { Button, Field, Input, Modal } from './ui';

const textareaClass =
  'min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
      <AlertIcon />
      <span>{message}</span>
    </div>
  );
}

function FormFooter({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? 'Guardando...' : label}
      </Button>
    </div>
  );
}

/** Datos generales del negocio: nombre, descripción, ciudad, dirección y barrio (las coordenadas se editan en el mapa). */
export function EditBusinessModal({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description ?? '');
  const [address, setAddress] = useState(client.address);
  const [neighborhood, setNeighborhood] = useState(client.neighborhood);
  const [cityId, setCityId] = useState(client.city?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/admin/clients/${client.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          description: description.trim(),
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          cityId: cityId || undefined,
        },
      });
      toast('Negocio actualizado', 'success');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Editar negocio" description="Datos generales del negocio" onClose={onClose} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <FormError message={error} />}
        <Field label="Nombre del negocio">
          {(id) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required />
          )}
        </Field>
        <Field label="Descripción" hint="Opcional, hasta 1000 caracteres">
          {(id) => (
            <textarea
              id={id}
              className={textareaClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <CityPicker cityId={cityId} initial={client.city} onChange={setCityId} />
          <Field label="Dirección">
            {(id) => (
              <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} minLength={3} maxLength={200} required />
            )}
          </Field>
          <Field label="Barrio / sector">
            {(id) => (
              <Input id={id} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} minLength={2} maxLength={100} required />
            )}
          </Field>
        </div>
        <FormFooter onClose={onClose} saving={saving} label="Guardar negocio" />
      </form>
    </Modal>
  );
}

/** Datos del responsable: nombre, celular y correo (con el que inicia sesión). */
export function EditOwnerModal({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { owner } = client;
  const [fullName, setFullName] = useState(owner.fullName);
  const [email, setEmail] = useState(owner.email ?? '');
  const [phone, setPhone] = useState(owner.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/admin/clients/${client.id}/owner`, {
        method: 'PATCH',
        body: { fullName: fullName.trim(), email: email.trim() || undefined, phone: phone.trim() },
      });
      toast('Responsable actualizado', 'success');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Editar responsable" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <FormError message={error} />}
        <Field label="Nombre completo">
          {(id) => (
            <Input id={id} value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={100} required />
          )}
        </Field>
        <Field label="Correo" hint="Con este correo inicia sesión; si lo cambias, entra con el nuevo.">
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Celular" hint="Opcional">
          {(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />}
        </Field>
        <FormFooter onClose={onClose} saving={saving} label="Guardar responsable" />
      </form>
    </Modal>
  );
}

/** Eliminación definitiva: hay que escribir el nombre del negocio para confirmar. */
export function DeleteClientModal({
  open,
  client,
  onClose,
}: {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === client.name.trim().toLowerCase();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matches) return;
    setError(null);
    setDeleting(true);
    try {
      await api(`/admin/clients/${client.id}`, { method: 'DELETE' });
      toast('Cliente eliminado', 'success');
      navigate('/clientes', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} title="Eliminar cliente" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <FormError message={error} />}
        <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Se borrarán de forma definitiva el negocio <strong>{client.name}</strong>, sus canchas, reservas,
          clientes, pagos, fotos y la cuenta de <strong>{client.owner.fullName}</strong>. No se puede deshacer.
        </div>
        <Field label={`Escribe «${client.name}» para confirmar`}>
          {(id) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
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
