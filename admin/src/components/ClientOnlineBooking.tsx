import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';
import { useApi } from '../lib/useApi';
import { Badge, Button, Card, ErrorBanner, Input, Skeleton, Switch } from './ui';

interface OnlineBooking {
  enabled: boolean;
  slug: string;
  url: string;
  bookingAvailable: boolean;
  unavailableReason: 'DISABLED' | 'PLAN_INACTIVE' | 'NO_COURTS' | null;
}

const REASONS: Record<string, string> = {
  DISABLED: 'Link desactivado',
  PLAN_INACTIVE: 'Plan inactivo',
  NO_COURTS: 'Falta una cancha completa (activa y con foto principal)',
};

/** Link público de reservas del negocio: copiar, abrir, activar y cambiar el slug. */
export function ClientOnlineBooking({ clientId }: { clientId: string }) {
  const notify = useToast();
  const settings = useApi<OnlineBooking>(`/admin/clients/${clientId}/online-booking`);
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function update(body: { enabled?: boolean; slug?: string }) {
    setSaving(true);
    setError(undefined);
    try {
      await api(`/admin/clients/${clientId}/online-booking`, { method: 'PATCH', body });
      notify(body.slug ? 'Link actualizado' : body.enabled ? 'Reservas en línea activadas' : 'Reservas en línea desactivadas');
      setEditing(false);
      settings.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copiado');
    } catch {
      notify('No se pudo copiar; selecciónalo y cópialo a mano', 'danger');
    }
  }

  const data = settings.data;
  return (
    <Card
      title="Reservas en línea"
      description="Link para que los jugadores se registren y reserven desde el celular"
      actions={
        data && (
          <div className="flex items-center gap-2 text-sm text-fg-2">
            {data.enabled ? 'Activo' : 'Desactivado'}
            <Switch
              checked={data.enabled}
              disabled={saving}
              label={data.enabled ? 'Desactivar reservas en línea' : 'Activar reservas en línea'}
              onChange={(enabled) => update({ enabled })}
            />
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {(settings.error || error) && <ErrorBanner message={(error ?? settings.error)!} onRetry={settings.error ? settings.reload : undefined} />}
        {!data ? (
          <Skeleton className="h-10" />
        ) : editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              update({ slug: slug.trim().toLowerCase() });
            }}
          >
            <span className="text-sm text-fg-3">{data.url.replace(data.slug, '')}</span>
            <Input
              aria-label="Slug del link"
              className="h-9 w-64"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Minúsculas, números y guiones"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <Button size="sm" type="submit" variant="primary" loading={saving}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <a href={data.url} target="_blank" rel="noreferrer" className="break-all font-medium text-accent hover:underline">
              {data.url}
            </a>
            <Badge tone={data.bookingAvailable ? 'success' : 'warn'}>
              {data.bookingAvailable ? 'Recibiendo reservas' : REASONS[data.unavailableReason ?? 'DISABLED']}
            </Badge>
            <div className="ml-auto flex gap-1">
              <Button size="sm" onClick={() => copy(data.url)}>
                Copiar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSlug(data.slug);
                  setEditing(true);
                }}
              >
                Cambiar link
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
