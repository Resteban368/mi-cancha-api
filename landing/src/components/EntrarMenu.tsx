import { useEffect, useRef, useState } from 'react';
import { PANEL_URL, PLAYER_LOGIN_URL } from '../config';
import { Icon, type IconName } from './Icon';

export const OPCIONES_ENTRAR: { href: string; icono: IconName; titulo: string; texto: string }[] = [
  { href: PLAYER_LOGIN_URL, icono: 'jugadores', titulo: 'Como jugador', texto: 'Tus reservas y tu perfil' },
  { href: PANEL_URL, icono: 'cancha', titulo: 'Como negocio', texto: 'El panel de tus canchas' },
];

/** Botón «Entrar» del header: abre un menú para elegir si se entra como jugador o como negocio. */
export function EntrarMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-fg-2 hover:text-fg"
      >
        Entrar
        <span aria-hidden="true" className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/30"
        >
          {OPCIONES_ENTRAR.map((o) => (
            <a
              key={o.href}
              href={o.href}
              role="menuitem"
              className="flex items-center gap-3 rounded-xl p-3 hover:bg-surface-2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <Icon name={o.icono} className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-fg">{o.titulo}</span>
                <span className="block text-xs text-fg-3">{o.texto}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
