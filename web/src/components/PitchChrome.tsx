import type { ReactNode, SVGProps } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { accountPath } from '../lib/next';
import { BrandMark, Wordmark } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { useSession } from '../lib/session';

const icon = (path: ReactNode, defaultViewBox = '0 0 24 24') =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox={defaultViewBox}
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
export const ArrowLeftIcon = icon(
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
export const ArrowForwardIcon = icon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);

export const PinIcon = icon(
  <>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
);

export const TuneIcon = icon(
  <>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </>,
);

export const AppsIcon = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </>,
);

export const StarIcon = function StarIcon({
  filled = true,
  ...props
}: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? '0' : '2'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
};

export const HeartIcon = function HeartIcon({
  filled = false,
  ...props
}: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
};

export const BookmarkIcon = icon(
  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
);

export const VerifiedIcon = function VerifiedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2l2.4 1.8 3-.2 1.3 2.7 2.8 1.1-.2 3 1.8 2.4-1.8 2.4.2 3-2.8 1.1-1.3 2.7-3-.2L12 22l-2.4-1.8-3 .2-1.3-2.7-2.8-1.1.2-3L1 12.2l1.8-2.4-.2-3 2.8-1.1 1.3-2.7 3 .2L12 2z" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="var(--accent-fg, #0b1f28)" strokeWidth="2.5" />
    </svg>
  );
};

export const SparklesIcon = icon(
  <>
    <path d="m12 3-1.9 4.3a2 2 0 0 1-.9.9L4.9 10l4.3 1.9a2 2 0 0 1 .9.9L12 17l1.9-4.3a2 2 0 0 1 .9-.9l4.3-1.9-4.3-1.9a2 2 0 0 1-.9-.9L12 3z" />
    <path d="M19 16v3M20.5 17.5h-3M5 6v2M6 7H4" />
  </>,
);

export const BoltIcon = icon(
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" />,
);

export const LoyaltyIcon = icon(
  <>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </>,
);

export const ParkingIcon = icon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="4" />
    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </>,
);

export const CoffeeIcon = icon(
  <>
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <line x1="6" x2="6" y1="2" y2="4" />
    <line x1="10" x2="10" y1="2" y2="4" />
    <line x1="14" x2="14" y1="2" y2="4" />
  </>,
);

export const WcIcon = icon(
  <>
    <circle cx="7" cy="5" r="2" />
    <circle cx="17" cy="5" r="2" />
    <path d="M4 21v-7a3 3 0 0 1 6 0v7M14 21l2-7h2l2 7M14 14l3-5 3 5" />
  </>,
);

export const RoofingIcon = icon(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>,
);

export const WifiIcon = icon(
  <>
    <path d="M12 20h.01" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    <path d="M5 12.859a10 10 0 0 1 14 0" />
    <path d="M1.5 9.288a15 15 0 0 1 21 0" />
  </>,
);

export const SecurityIcon = icon(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
);

export const StoreIcon = icon(
  <>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" />
    <path d="M5 12v8h14v-8M10 20v-4h4v4" />
  </>,
);

export const UserIcon = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);

export const LoginIcon = icon(
  <>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="m10 16 4-4-4-4M14 12H4" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);

export const SoccerIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 7 3.5 2.5v4L12 16l-3.5-2.5v-4z" />
    <path d="M12 7V2M15.5 9.5 21 7M15.5 13.5 20 18M12 16v6M8.5 13.5 4 18M8.5 9.5 3 7" />
  </>,
);

/** Icono dinámico según el código de la amenidad/servicio */
export function AmenityIcon({ code, className = 'size-3.5' }: { code: string; className?: string }) {
  const norm = code.toUpperCase();
  if (norm.includes('PARK') || norm.includes('PARQUEADERO') || norm.includes('ESTACIONAMIENTO')) {
    return <ParkingIcon className={className} />;
  }
  if (norm.includes('CAFE') || norm.includes('BAR') || norm.includes('RESTAURANTE') || norm.includes('SNACK')) {
    return <CoffeeIcon className={className} />;
  }
  if (norm.includes('BANO') || norm.includes('DUCHA') || norm.includes('VESTIER') || norm.includes('WC')) {
    return <WcIcon className={className} />;
  }
  if (norm.includes('TECH') || norm.includes('CUBIER')) {
    return <RoofingIcon className={className} />;
  }
  if (norm.includes('WIFI') || norm.includes('INTERNET')) {
    return <WifiIcon className={className} />;
  }
  if (norm.includes('TIENDA') || norm.includes('SHOP') || norm.includes('ALQUILER') || norm.includes('PALAS')) {
    return <StoreIcon className={className} />;
  }
  if (norm.includes('SEGURIDAD') || norm.includes('VIGILAN')) {
    return <SecurityIcon className={className} />;
  }
  if (norm.includes('LUZ') || norm.includes('ILUMINACION')) {
    return <BoltIcon className={className} />;
  }
  return <SparklesIcon className={className} />;
}

/** Barra superior del directorio: marca, selector de ciudad, "Mis sedes" y la cuenta del jugador. */
export function PitchHeader({
  cityLabel,
  onCityClick,
}: {
  cityLabel?: string | null;
  onCityClick?: () => void;
}) {
  const { player, signOut } = useSession();
  const { pathname, search } = useLocation();
  const initial = player?.fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-bg/90 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="group flex items-center gap-2.5 transition active:scale-95">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0f8b7a] to-accent p-0.5 shadow-md shadow-accent/20 ring-1 ring-accent/40">
              <BrandMark size={32} className="size-full rounded-[14px] object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <Wordmark className="text-xl" />
                <span className="inline-block size-2 rounded-full bg-accent animate-pulse" title="En línea" />
              </div>
              {onCityClick ? (
                <button
                  type="button"
                  onClick={onCityClick}
                  className="mt-0.5 flex items-center gap-1 text-[11px] font-medium tracking-wide text-fg-3 uppercase transition hover:text-accent-text"
                >
                  <PinIcon className="size-3 text-accent" />
                  <span className="truncate">{cityLabel ?? 'Todas las sedes'} · COP</span>
                  <ChevronDownIcon className="size-3 opacity-60" />
                </button>
              ) : (
                <span className="mt-0.5 block text-[10px] font-medium tracking-wider text-fg-3 uppercase">
                  {cityLabel ?? 'Colombia'} · COP
                </span>
              )}
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <ThemeToggle cycle />
          {player ? (
            <>
              <Link
                to="/mis-sedes"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-bold text-accent-text transition hover:bg-accent/20 active:scale-95"
              >
                <BookmarkIcon className="size-3.5 text-accent" />
                <span>Mis sedes</span>
              </Link>
              <div className="relative">
                <Link
                  to="/perfil"
                  aria-label="Mi perfil"
                  className="flex size-9 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-surface to-surface-2 text-xs font-extrabold text-fg shadow-sm transition hover:border-accent active:scale-95"
                >
                  {initial}
                </Link>
                <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-bg bg-accent text-[8px] font-black text-accent-fg">
                  ✓
                </span>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="hidden sm:block rounded-xl px-2.5 py-2 text-xs font-semibold text-fg-3 transition hover:bg-hover hover:text-fg"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to={accountPath('ingresar', `${pathname}${search}`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3.5 py-2 text-xs font-bold text-accent-text transition hover:bg-accent/25 active:scale-95 shadow-sm"
            >
              <LoginIcon className="size-4" />
              <span>Ingresar</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Barra inferior para el celular: explorar, mis sedes y cuenta con estilo de app moderna. */
export function PitchBottomNav() {
  const { player } = useSession();
  const { pathname, search } = useLocation();

  const tab = ({ isActive }: { isActive: boolean }) =>
    'relative flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] tracking-tight transition-all ' +
    (isActive ? 'font-extrabold text-accent-text' : 'font-medium text-fg-3 hover:text-fg-2');

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline/80 bg-bg/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden shadow-lg"
    >
      <div className={`mx-auto grid max-w-md px-3 pt-1 ${player ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <NavLink to="/" end className={tab}>
          {({ isActive }) => (
            <>
              <div className="relative">
                <SearchIcon className="size-5 transition-transform" />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                )}
              </div>
              <span>Explorar</span>
            </>
          )}
        </NavLink>
        {player ? (
          <>
            <NavLink to="/reservas" className={tab}>
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <CalendarIcon className="size-5 transition-transform" />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                    )}
                  </div>
                  <span>Reservas</span>
                </>
              )}
            </NavLink>
            <NavLink to="/mis-sedes" className={tab}>
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <StoreIcon className="size-5 transition-transform" />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                    )}
                  </div>
                  <span>Mis sedes</span>
                </>
              )}
            </NavLink>
            <NavLink to="/perfil" className={tab}>
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <UserIcon className="size-5 transition-transform" />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                    )}
                  </div>
                  <span>Perfil</span>
                </>
              )}
            </NavLink>
          </>
        ) : (
          <NavLink to={accountPath('ingresar', `${pathname}${search}`)} className={tab}>
            <div className="relative">
              <LoginIcon className="size-5" />
            </div>
            <span>Ingresar</span>
          </NavLink>
        )}
      </div>
      <div className="mx-auto mt-2 h-1 w-28 rounded-full bg-fg-3/20" />
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
    <header className="sticky top-0 z-30 border-b border-hairline/80 bg-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
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
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition hover:bg-hover hover:text-fg"
              >
                Mis reservas
              </Link>
              <Link
                to="/perfil"
                aria-label="Mi perfil"
                className="flex size-8 items-center justify-center rounded-xl border border-hairline bg-surface text-xs font-bold text-fg transition hover:border-border"
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
