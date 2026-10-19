import { Fragment, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
} from '../components/ui';
import { formatDateTime, ROLE_LABELS } from '../lib/format';
import type { AuditAction, AuditCategory, AuditEntry, AuditPage as AuditPageData } from '../lib/security-types';
import { useApi, useDebounced } from '../lib/useApi';

const PAGE_SIZE = 25;

const CATEGORIES: { value: AuditCategory | ''; label: string }[] = [
  { value: '', label: 'Todo' },
  { value: 'ADMIN', label: 'Acciones del admin' },
  { value: 'SECURITY', label: 'Seguridad' },
];

const CATEGORY_LABELS: Record<AuditCategory, string> = { ADMIN: 'Admin', SECURITY: 'Seguridad' };

/** Auditoría: qué se hizo en la plataforma, quién lo hizo y desde dónde. */
export function AuditPage() {
  const [category, setCategory] = useState<AuditCategory | ''>('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState<'' | 'true' | 'false'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const term = useDebounced(search.trim());

  const actions = useApi<AuditAction[]>('/admin/security/audit/actions');
  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (category) params.set('category', category);
    if (action) params.set('action', action);
    if (result) params.set('success', result);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (term) params.set('search', term);
    return `/admin/security/audit?${params}`;
  }, [page, category, action, result, from, to, term]);
  const log = useApi<AuditPageData>(path);

  const labels = useMemo(() => new Map((actions.data ?? []).map((a) => [a.code, a.label])), [actions.data]);
  const visibleActions = (actions.data ?? []).filter((a) => !category || a.category === category);
  const hasFilters = Boolean(category || action || result || from || to || search);

  /** Cualquier filtro vuelve a la primera página. */
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  function clear() {
    setCategory('');
    setAction('');
    setResult('');
    setFrom('');
    setTo('');
    setSearch('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Lo que hace el super admin en el panel y los eventos de seguridad: ingresos, registros y recuperación de clave."
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={category === c.value}
                  onClick={() => {
                    setCategory(c.value);
                    setAction('');
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    category === c.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Input
              className="max-w-xs"
              type="search"
              aria-label="Buscar por quién lo hizo o por id"
              placeholder="Buscar por nombre, celular, correo o id"
              value={search}
              onChange={(e) => filter(setSearch)(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              className="max-w-[260px]"
              aria-label="Acción"
              value={action}
              onChange={(e) => filter(setAction)(e.target.value)}
            >
              <option value="">Todas las acciones</option>
              {visibleActions.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Select
              className="max-w-[180px]"
              aria-label="Resultado"
              value={result}
              onChange={(e) => filter(setResult)(e.target.value as '' | 'true' | 'false')}
            >
              <option value="">Cualquier resultado</option>
              <option value="true">Correctos</option>
              <option value="false">Rechazados</option>
            </Select>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              Desde
              <Input className="w-40" type="date" max={to || undefined} value={from} onChange={(e) => filter(setFrom)(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              Hasta
              <Input className="w-40" type="date" min={from || undefined} value={to} onChange={(e) => filter(setTo)(e.target.value)} />
            </label>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clear}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {log.error && (
          <div className="p-4">
            <ErrorBanner message={log.error} onRetry={log.reload} />
          </div>
        )}

        {!log.data ? (
          log.loading && (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )
        ) : log.data.items.length === 0 ? (
          <EmptyState title="Sin eventos">No hay eventos con esos filtros.</EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Quién</Th>
                  <Th>Acción</Th>
                  <Th>Objeto</Th>
                  <Th>Origen</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {log.data.items.map((entry) => (
                  <Row
                    key={entry.id}
                    entry={entry}
                    label={labels.get(entry.action) ?? entry.action}
                    expanded={open === entry.id}
                    onToggle={() => setOpen(open === entry.id ? null : entry.id)}
                  />
                ))}
              </tbody>
            </Table>
            <Pagination page={log.data.page} pageSize={log.data.pageSize} total={log.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

function Row({
  entry,
  label,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailId = `audit-detail-${entry.id}`;
  return (
    <Fragment>
      <tr>
        <Td className="whitespace-nowrap text-fg-2">{formatDateTime(entry.createdAt)}</Td>
        <Td>
          {entry.actorLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{entry.actorLabel}</span>
              {entry.actorRole && <Badge tone={entry.actorRole === 'SUPER_ADMIN' ? 'warn' : 'neutral'}>{ROLE_LABELS[entry.actorRole]}</Badge>}
            </div>
          ) : (
            <span className="text-fg-3">Sin sesión</span>
          )}
        </Td>
        <Td>
          <div className="flex flex-wrap items-center gap-2">
            <span>{label}</span>
            {!entry.success && <Badge tone="danger">Rechazado</Badge>}
            <Badge tone={entry.category === 'SECURITY' ? 'warn' : 'neutral'}>{CATEGORY_LABELS[entry.category]}</Badge>
          </div>
        </Td>
        <Td className="text-fg-2">
          {entry.entityType ? (
            <>
              <span>{entry.entityType}</span>
              {entry.entityId && <span className="ml-1 font-mono text-xs text-fg-3">{entry.entityId.slice(0, 8)}</span>}
            </>
          ) : (
            '—'
          )}
        </Td>
        <Td className="font-mono text-xs text-fg-2">{entry.source ?? '—'}</Td>
        <Td align="right">
          {entry.metadata && (
            <Button size="sm" variant="ghost" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}>
              {expanded ? 'Ocultar' : 'Detalle'}
            </Button>
          )}
        </Td>
      </tr>
      {expanded && entry.metadata && (
        <tr id={detailId}>
          <td colSpan={6} className="border-b border-border bg-surface-2/50 px-4 py-3">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-fg-2">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
            {entry.actorId && <p className="mt-2 font-mono text-xs text-fg-3">Cuenta: {entry.actorId}</p>}
            {entry.entityId && <p className="font-mono text-xs text-fg-3">Objeto: {entry.entityId}</p>}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
