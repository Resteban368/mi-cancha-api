import { Link } from 'react-router';
import { formatDateTime } from '../lib/format';
import type { AuditAction, AuditPage } from '../lib/security-types';
import { useApi } from '../lib/useApi';
import { Badge, Card, EmptyState, ErrorBanner, Skeleton } from './ui';

/** Los últimos eventos de la auditoría, con acceso a la lista completa. */
export function RecentAudit() {
  const log = useApi<AuditPage>('/admin/security/audit?pageSize=6');
  const actions = useApi<AuditAction[]>('/admin/security/audit/actions');
  const labels = new Map((actions.data ?? []).map((a) => [a.code, a.label]));

  return (
    <Card
      title="Auditoría reciente"
      description="Lo último que pasó en la plataforma"
      actions={
        <Link to="/auditoria" className="text-sm font-medium text-accent-text hover:underline">
          Ver toda la auditoría
        </Link>
      }
    >
      {log.error && (
        <div className="p-4">
          <ErrorBanner message={log.error} onRetry={log.reload} />
        </div>
      )}
      {!log.data ? (
        log.loading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )
      ) : log.data.items.length === 0 ? (
        <EmptyState title="Sin eventos">Todavía no hay actividad registrada.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {log.data.items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                  {labels.get(entry.action) ?? entry.action}
                  {!entry.success && <Badge tone="danger">Rechazado</Badge>}
                </p>
                <p className="truncate text-xs text-fg-3">{entry.actorLabel ?? 'Sin sesión'}</p>
              </div>
              <time dateTime={entry.createdAt} className="whitespace-nowrap text-xs text-fg-2">
                {formatDateTime(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
