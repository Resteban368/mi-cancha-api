import { useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import type { BroadcastRecipient, BroadcastResult } from '../lib/security-types';
import { useToast } from '../lib/toast';
import { useApi, useDebounced } from '../lib/useApi';

const TITLE_MAX = 60;
const BODY_MAX = 240;

type Scope = 'ALL' | 'SELECTED';

/** Aviso del super admin: una notificación del navegador a todos los negocios o a los que elija. */
export function NotificationsPage() {
  const notify = useToast();
  const recipients = useApi<BroadcastRecipient[]>('/admin/notifications/recipients');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<Scope>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [last, setLast] = useState<BroadcastResult>();
  const term = useDebounced(search.trim().toLowerCase());

  const all = useMemo(() => recipients.data ?? [], [recipients.data]);
  const reachableAll = all.filter((r) => r.devices > 0 && !r.banned).length;
  const visible = useMemo(
    () =>
      all.filter(
        (r) => !term || r.name.toLowerCase().includes(term) || r.ownerName.toLowerCase().includes(term),
      ),
    [all, term],
  );
  const reachableSelected = all.filter((r) => selected.has(r.businessId) && r.devices > 0 && !r.banned).length;

  const targetCount = scope === 'ALL' ? all.length : selected.size;
  const reachable = scope === 'ALL' ? reachableAll : reachableSelected;
  const canSend = title.trim() !== '' && body.trim() !== '' && targetCount > 0;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function selectVisible(on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const r of visible) {
        if (on) next.add(r.businessId);
        else next.delete(r.businessId);
      }
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const result = await api<BroadcastResult>('/admin/notifications/broadcast', {
        method: 'POST',
        body: {
          title: title.trim(),
          body: body.trim(),
          all: scope === 'ALL',
          ...(scope === 'SELECTED' && { businessIds: [...selected] }),
        },
      });
      setLast(result);
      notify(`Aviso enviado a ${formatNumber(result.delivered)} ${result.delivered === 1 ? 'navegador' : 'navegadores'}`);
      setTitle('');
      setBody('');
      recipients.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Avisos"
        description="Envía una notificación a los negocios que tienen los avisos activados en su navegador."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Mensaje">
          <form onSubmit={submit} className="flex flex-col gap-4 p-4">
            {error && <ErrorBanner message={error} />}
            <Field label="Título" hint={`${title.length}/${TITLE_MAX}`}>
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej.: Mantenimiento programado"
                />
              )}
            </Field>
            <Field label="Mensaje" hint={`${body.length}/${BODY_MAX}`}>
              {(id) => (
                <textarea
                  id={id}
                  required
                  rows={4}
                  maxLength={BODY_MAX}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                  placeholder="Qué quieres decirles"
                />
              )}
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">Destinatarios</legend>
              {(
                [
                  ['ALL', `Todos los negocios (${formatNumber(all.length)})`],
                  ['SELECTED', 'Elegir negocios'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    className="size-4 accent-[var(--accent)]"
                    checked={scope === value}
                    onChange={() => setScope(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-sm text-fg-2">
              {recipients.data ? (
                <>
                  Llegará a <span className="font-semibold text-fg">{formatNumber(reachable)}</span> de{' '}
                  {formatNumber(targetCount)} {targetCount === 1 ? 'negocio' : 'negocios'}. El resto no tiene los
                  avisos activados (o su cuenta está bloqueada).
                </>
              ) : (
                'Calculando destinatarios…'
              )}
            </div>

            {last && (
              <p className="text-sm text-fg-2">
                Último envío: {formatNumber(last.reachable)} de {formatNumber(last.businesses)} negocios alcanzables,{' '}
                {formatNumber(last.delivered)} {last.delivered === 1 ? 'navegador' : 'navegadores'}.
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={sending} disabled={!canSend}>
                Enviar aviso
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Negocios" description="Quiénes pueden recibirlo ahora mismo">
          {recipients.error ? (
            <div className="p-4">
              <ErrorBanner message={recipients.error} onRetry={recipients.reload} />
            </div>
          ) : !recipients.data ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <Input
                  className="max-w-xs"
                  type="search"
                  aria-label="Buscar negocio"
                  placeholder="Buscar negocio o dueño"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {scope === 'SELECTED' && (
                  <>
                    <Button size="sm" onClick={() => selectVisible(true)}>
                      Marcar los de la lista
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => selectVisible(false)}>
                      Quitar
                    </Button>
                    <span className="text-xs text-fg-3">{selected.size} elegidos</span>
                  </>
                )}
              </div>
              {visible.length === 0 ? (
                <EmptyState title="Sin resultados" />
              ) : (
                <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                  {visible.map((r) => (
                    <li key={r.businessId}>
                      <label
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                          scope === 'SELECTED' ? 'cursor-pointer hover:bg-surface-2' : ''
                        }`}
                      >
                        {scope === 'SELECTED' && (
                          <input
                            type="checkbox"
                            className="size-4 shrink-0 accent-[var(--accent)]"
                            checked={selected.has(r.businessId)}
                            onChange={() => toggle(r.businessId)}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">{r.name}</span>
                          <span className="block truncate text-xs text-fg-3">{r.ownerName}</span>
                        </span>
                        {r.banned ? (
                          <Badge tone="danger">Bloqueado</Badge>
                        ) : r.devices > 0 ? (
                          <Badge tone="success">
                            {r.devices} {r.devices === 1 ? 'navegador' : 'navegadores'}
                          </Badge>
                        ) : (
                          <Badge>Sin avisos</Badge>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
