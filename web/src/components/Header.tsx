import { Link } from 'react-router';
import { useSession } from '../lib/session';

/** Barra superior: marca y acceso a la cuenta (en la sede `slug`, si la hay). */
export function Header({ slug, businessName }: { slug?: string; businessName?: string }) {
  const { player, signOut } = useSession();
  const base = slug ? `/${slug}` : '';
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to={slug ? `/${slug}` : '/'} className="flex min-w-0 items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/icon-128.png`} alt="" width={32} height={32} className="rounded-[22%]" />
          <span className="truncate font-semibold">{businessName ?? 'Mi Cancha'}</span>
        </Link>
        {slug && (
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            {player ? (
              <>
                <Link to={`${base}/mis-reservas`} className="rounded-lg px-3 py-2 font-medium text-accent hover:bg-accent-soft">
                  Mis reservas
                </Link>
                <Link to={`${base}/perfil`} className="rounded-lg px-3 py-2 font-medium text-fg-2 hover:bg-surface-2">
                  Mi perfil
                </Link>
                <button type="button" onClick={signOut} className="rounded-lg px-3 py-2 text-fg-2 hover:bg-surface-2">
                  Salir
                </button>
              </>
            ) : (
              <Link to={`${base}/ingresar`} className="rounded-lg px-3 py-2 font-medium text-accent hover:bg-accent-soft">
                Ingresar
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
