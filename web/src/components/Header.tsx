import { Link, useLocation } from 'react-router';
import { accountPath } from '../lib/next';
import { useSession } from '../lib/session';

const ON_ACCOUNT_PAGE = /^\/(ingresar|registro|recuperar)(\/|$)/;

/**
 * Barra superior: marca y cuenta del jugador, que es una sola para todas las sedes.
 * `slug` solo cambia a dónde lleva la marca (la sede, si estamos en una).
 */
export function Header({ slug, businessName }: { slug?: string; businessName?: string }) {
  const { player, signOut } = useSession();
  const { pathname, search } = useLocation();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to={slug ? `/${slug}` : '/'} className="flex min-w-0 items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/icon-128.png`} alt="" width={32} height={32} className="rounded-[22%]" />
          <span className="truncate font-semibold">{businessName ?? 'Mi Cancha'}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          {player ? (
            <>
              <Link to="/mis-sedes" className="rounded-lg px-3 py-2 font-medium text-accent hover:bg-accent-soft">
                Mis sedes
              </Link>
              <Link to="/perfil" className="rounded-lg px-3 py-2 font-medium text-fg-2 hover:bg-surface-2">
                Mi perfil
              </Link>
              <button type="button" onClick={signOut} className="rounded-lg px-3 py-2 text-fg-2 hover:bg-surface-2">
                Salir
              </button>
            </>
          ) : (
            !ON_ACCOUNT_PAGE.test(pathname) && (
              <Link
                to={accountPath('ingresar', `${pathname}${search}`)}
                className="rounded-lg px-3 py-2 font-medium text-accent hover:bg-accent-soft"
              >
                Ingresar
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
