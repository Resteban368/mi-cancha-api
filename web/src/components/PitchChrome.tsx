import type { ReactNode, SVGProps } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { accountPath } from '../lib/next';
import { BrandMark, Wordmark } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { useSession } from '../lib/session';

const icon = (path: ReactNode) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);
export const CloseIcon = icon(<path d="M6 18 18 6M6 6l12 12" />);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const ChevronRightIcon = icon(<path d="m9 5 7 7-7 7" />);
export const PinIcon = icon(
  <>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
);
const StoreIcon = icon(
  <>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" />
    <path d="M5 12v8h14v-8M10 20v-4h4v4" />
  </>,
);
const UserIcon = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);
const LoginIcon = icon(
  <>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="m10 16 4-4-4-4M14 12H4" />
  </>,
);
const ArrowLeftIcon = icon(
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
const CalendarIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);

/** Barra superior del directorio: marca, "Mis sedes" y la cuenta del jugador. */
export function PitchHeader() {
  const { player, signOut } = useSession();
  const { pathname, search } = useLocation();
  const initial = player?.fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="rounded-xl shadow-md shadow-accent/20" />
          <Wordmark className="text-lg" />
        </Link>

        <nav className="flex items-center gap-2">
          <ThemeToggle cycle />
          {player ? (
            <>
              <Link
                to="/reservas"
                className="hidden whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide text-fg-2 transition hover:text-fg sm:block"
              >
                Mis reservas
              </Link>
              <Link
                to="/mis-sedes"
                className="whitespace-nowrap rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-accent-text transition active:scale-95"
              >
                Mis sedes
              </Link>
              <Link
                to="/perfil"
                aria-label="Mi perfil"
                className="flex size-9 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-bold text-fg transition active:scale-95"
              >
                {initial}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-3 transition hover:text-fg sm:block"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to={accountPath('ingresar', `${pathname}${search}`)}
              className="whitespace-nowrap rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-accent-text transition active:scale-95"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Barra inferior para el celular: explorar, mis sedes y cuenta. */
export function PitchBottomNav() {
  const { player } = useSession();
  const { pathname, search } = useLocation();

  const tab = ({ isActive }: { isActive: boolean }) =>
    'relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] tracking-tight transition-colors ' +
    (isActive ? 'font-bold text-accent-text' : 'font-medium text-fg-3 hover:text-fg-2');

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <div className={`mx-auto grid max-w-md px-2 ${player ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <NavLink to="/" end className={tab}>
          {({ isActive }) => (
            <>
              <SearchIcon className="size-5" />
              Explorar
              {isActive && <span className="absolute bottom-0.5 size-1 rounded-full bg-accent" aria-hidden />}
            </>
          )}
        </NavLink>
        {player ? (
          <>
            <NavLink to="/reservas" className={tab}>
              <CalendarIcon className="size-5" />
              Mis reservas
            </NavLink>
            <NavLink to="/mis-sedes" className={tab}>
              <StoreIcon className="size-5" />
              Mis sedes
            </NavLink>
            <NavLink to="/perfil" className={tab}>
              <UserIcon className="size-5" />
              Perfil
            </NavLink>
          </>
        ) : (
          <NavLink to={accountPath('ingresar', `${pathname}${search}`)} className={tab}>
            <LoginIcon className="size-5" />
            Ingresar
          </NavLink>
        )}
      </div>
    </nav>
  );
}

/** Barra superior de una sede: marca de la sede, "Info sede" y la cuenta del jugador. */
export function BusinessHeader({
  slug,
  name,
  address,
  onInfo,
}: {
  slug: string;
  name?: string;
  address?: string;
  onInfo?: () => void;
}) {
  const { player } = useSession();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const initial = player?.fullName.trim().charAt(0).toUpperCase() || '?';

  /** Vuelve a la pantalla anterior; si se abrió el link directo, al listado de sedes. */
  function goBack(event: { preventDefault: () => void }) {
    if (window.history.state?.idx > 0) {
      event.preventDefault();
      navigate(-1);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            to="/"
            onClick={goBack}
            aria-label="Volver"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-fg transition hover:bg-surface-2 active:scale-95"
          >
            <ArrowLeftIcon className="size-5" strokeWidth={2.5} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-none tracking-tight">{name ?? 'Mi Cancha'}</h1>
            {address &&
              (onInfo ? (
                <button
                  type="button"
                  onClick={onInfo}
                  className="mt-1 inline-flex max-w-full items-center text-[11px] font-medium text-accent-text transition hover:brightness-125"
                >
                  <span className="truncate">{address} · Info sede</span>
                  <ChevronRightIcon className="ml-0.5 size-3 shrink-0" />
                </button>
              ) : (
                <p className="mt-1 truncate text-[11px] text-fg-3">{address}</p>
              ))}
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle cycle />
          {player ? (
            <>
              <Link
                to={`/${slug}/mis-reservas`}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-2 transition hover:bg-hover hover:text-fg"
              >
                Mis reservas
              </Link>
              <Link
                to="/perfil"
                aria-label="Mi perfil"
                className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface text-xs font-bold text-fg transition hover:border-border"
              >
                {initial}
              </Link>
            </>
          ) : (
            <Link
              to={accountPath('ingresar', `${pathname}${search}`)}
              className="whitespace-nowrap rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-accent-text transition active:scale-95"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
