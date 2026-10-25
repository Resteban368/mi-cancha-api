import { ThemeToggle } from './ThemeToggle';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth-context';
import {
  BrandMark,
  DashboardIcon,
  ListIcon,
  LogoutIcon,
  PlanIcon,
  StoreIcon,
  UsersIcon,
} from './icons';
import { BellIcon, ShieldIcon } from './security-icons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/clientes', label: 'Clientes', icon: StoreIcon },
  { to: '/usuarios', label: 'Usuarios', icon: UsersIcon },
  { to: '/planes', label: 'Planes', icon: PlanIcon },
  { to: '/catalogos', label: 'Catálogos', icon: ListIcon },
  { to: '/avisos', label: 'Avisos', icon: BellIcon },
  { to: '/auditoria', label: 'Auditoría', icon: ShieldIcon },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-accent-soft text-accent-text' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
  ].join(' ');

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-5">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold tracking-tight text-fg">
                <span className="text-accent">Mi</span> Cancha
              </p>
              <p className="text-xs text-fg-3">Administración</p>
            </div>
          </div>
          <ThemeToggle cycle className="ml-auto lg:hidden" />
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2 text-fg-2 hover:bg-surface-2 lg:hidden"
            aria-label="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        </div>
        <nav
          aria-label="Principal"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-border p-4 lg:block">
          <p className="truncate text-sm font-medium text-fg">{user?.displayName}</p>
          <p className="text-xs text-fg-3">Super admin</p>
          <ThemeToggle className="mt-3" />
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-sm text-fg-2 hover:text-fg"
          >
            <LogoutIcon /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
