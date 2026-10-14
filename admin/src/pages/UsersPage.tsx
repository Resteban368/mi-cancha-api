import { useState } from 'react';
import { SearchIcon } from '../components/icons';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Pagination,
  Skeleton,
  Table,
  Td,
  Th,
} from '../components/ui';
import { formatDate, PROVIDER_LABELS, ROLE_LABELS } from '../lib/format';
import type { AdminUser, Page, UserRole } from '../lib/types';
import { useApi, useDebounced } from '../lib/useApi';

const PAGE_SIZE = 20;
const FILTERS: { value: UserRole | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'JUGADOR', label: 'Jugadores' },
  { value: 'ADMIN_NEGOCIO', label: 'Negocios' },
  { value: 'SUPER_ADMIN', label: 'Super admin' },
];

export function UsersPage() {
  const [role, setRole] = useState<UserRole | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (role) query.set('role', role);
  if (debouncedSearch) query.set('search', debouncedSearch);
  const users = useApi<Page<AdminUser>>(`/admin/users?${query}`);

  return (
    <>
      <PageHeader title="Usuarios" description="Todas las cuentas: jugadores, negocios y administradores." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div role="group" aria-label="Filtrar por rol" className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={role === f.value}
                onClick={() => {
                  setRole(f.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  role === f.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative block min-w-56 flex-1 sm:max-w-sm">
            <span className="sr-only">Buscar usuarios</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">
              <SearchIcon />
            </span>
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, email o teléfono…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        {users.error && (
          <div className="p-4">
            <ErrorBanner message={users.error} onRetry={users.reload} />
          </div>
        )}

        {users.loading && !users.data ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : users.data && users.data.items.length === 0 ? (
          <EmptyState title="Sin resultados">No hay usuarios con esos filtros.</EmptyState>
        ) : (
          users.data && (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Nombre</Th>
                    <Th>Contacto</Th>
                    <Th>Rol</Th>
                    <Th>Negocio</Th>
                    <Th>Acceso</Th>
                    <Th>Alta</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id}>
                      <Td>
                        <p className="font-medium">{user.displayName}</p>
                        {user.verified && <p className="text-xs text-fg-3">Verificado</p>}
                      </Td>
                      <Td>
                        <p>{user.email ?? '—'}</p>
                        {user.phone && <p className="text-xs text-fg-3">{user.phone}</p>}
                      </Td>
                      <Td>
                        <Badge tone={user.role === 'SUPER_ADMIN' ? 'warn' : user.role === 'ADMIN_NEGOCIO' ? 'success' : 'neutral'}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </Td>
                      <Td className="text-fg-2">{user.businessName ?? '—'}</Td>
                      <Td className="text-fg-2">
                        {user.authProviders.length
                          ? user.authProviders.map((p) => PROVIDER_LABELS[p] ?? p).join(', ')
                          : 'Sin acceso'}
                      </Td>
                      <Td className="whitespace-nowrap text-fg-2">{formatDate(user.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={users.data.page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onChange={setPage}
              />
            </>
          )
        )}
      </Card>
    </>
  );
}
