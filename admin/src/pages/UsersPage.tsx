import { useState } from 'react';
import { DeletePlayersDialog } from '../components/DeletePlayersDialog';
import { BanUserDialog, UnbanUserDialog, type BanTarget } from '../components/BanDialogs';
import { SearchIcon, TrashIcon } from '../components/icons';
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
import { formatDate, PROVIDER_LABELS, ROLE_LABELS } from '../lib/format';
import type { BanFields } from '../lib/security-types';
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
  const [status, setStatus] = useState<'' | 'banned' | 'active'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toBan, setToBan] = useState<BanTarget | null>(null);
  const [toUnban, setToUnban] = useState<BanTarget | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (role) query.set('role', role);
  if (status) query.set('banned', String(status === 'banned'));
  if (debouncedSearch) query.set('search', debouncedSearch);
  const users = useApi<Page<AdminUser & BanFields>>(`/admin/users?${query}`);

  // Solo se pueden eliminar jugadores; la selección vale para la página que se está viendo.
  const players = (users.data?.items ?? []).filter((u) => u.role === 'JUGADOR');
  const allSelected = players.length > 0 && players.every((u) => selected.has(u.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(players.map((u) => u.id)));
  const changePage = (next: number) => {
    setSelected(new Set());
    setPage(next);
  };

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
                  changePage(1);
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
                changePage(1);
              }}
            />
          </label>
          <Select
            className="max-w-44"
            aria-label="Estado de la cuenta"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | 'banned' | 'active');
              changePage(1);
            }}
          >
            <option value="">Cualquier estado</option>
            <option value="active">Activas</option>
            <option value="banned">Bloqueadas</option>
          </Select>
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
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent-soft px-4 py-2.5 text-sm">
                  <span className="font-medium text-fg">
                    {selected.size === 1 ? '1 jugador seleccionado' : `${selected.size} jugadores seleccionados`}
                  </span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
                      Quitar selección
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setToDelete([...selected])}>
                      <TrashIcon width={14} height={14} /> Eliminar seleccionados
                    </Button>
                  </span>
                </div>
              )}
              <Table>
                <thead>
                  <tr>
                    <Th>
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos los jugadores de la página"
                        className="size-4 accent-[var(--accent)] disabled:opacity-40"
                        checked={allSelected}
                        disabled={players.length === 0}
                        onChange={toggleAll}
                      />
                    </Th>
                    <Th>Nombre</Th>
                    <Th>Contacto</Th>
                    <Th>Rol</Th>
                    <Th>Negocio</Th>
                    <Th>Acceso</Th>
                    <Th>Estado</Th>
                    <Th>Alta</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id}>
                      <Td>
                        {user.role === 'JUGADOR' && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar a ${user.displayName}`}
                            className="size-4 accent-[var(--accent)]"
                            checked={selected.has(user.id)}
                            onChange={() => toggle(user.id)}
                          />
                        )}
                      </Td>
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
                      <Td>
                        {user.bannedAt ? (
                          <div title={user.bannedReason ?? undefined}>
                            <Badge tone="danger">Bloqueada</Badge>
                            <p className="mt-1 max-w-48 truncate text-xs text-fg-3">{user.bannedReason}</p>
                          </div>
                        ) : (
                          <span className="text-fg-3">Activa</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-fg-2">{formatDate(user.createdAt)}</Td>
                      <Td align="right">
                        {user.role !== 'SUPER_ADMIN' &&
                          (user.bannedAt ? (
                            <Button size="sm" onClick={() => setToUnban(user)}>
                              Desbloquear
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setToBan(user)}>
                              Bloquear
                            </Button>
                          ))}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={users.data.page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onChange={changePage}
              />
            </>
          )
        )}
      </Card>

      <DeletePlayersDialog
        ids={toDelete}
        onClose={() => setToDelete(null)}
        onDone={() => {
          setToDelete(null);
          setSelected(new Set());
          users.reload();
        }}
      />
      <BanUserDialog user={toBan} onClose={() => setToBan(null)} onDone={users.reload} />
      <UnbanUserDialog user={toUnban} onClose={() => setToUnban(null)} onDone={users.reload} />
    </>
  );
}
