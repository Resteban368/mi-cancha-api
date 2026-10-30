import { useState } from 'react';
import { CtaLink } from './ui';
import { EntrarMenu, OPCIONES_ENTRAR } from './EntrarMenu';
import { Icon } from './Icon';

const LINKS = [
  // { href: '#deportes', label: 'Deportes' }, // oculta junto con la sección (ver App.tsx)
  { href: '#como', label: 'Cómo funciona' },
  { href: '#jugadores', label: 'Para jugadores' },
  { href: '#negocios', label: 'Para negocios' },
  { href: '#ventas', label: 'Ventas e inventario' },
  { href: '#planes', label: 'Precios' },
  { href: '#preguntas', label: 'Preguntas' },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#" aria-label="Mi Cancha, inicio">
          <img src="/brand/logo-h-light.png" alt="Mi Cancha" width={220} height={40} className="h-10 w-auto dark:hidden" />
          <img
            src="/brand/logo-h-dark.png"
            alt=""
            aria-hidden="true"
            width={220}
            height={40}
            className="hidden h-10 w-auto dark:block"
          />
        </a>

        <ul className="hidden items-center gap-6 text-sm font-semibold text-fg-2 xl:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="whitespace-nowrap hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <EntrarMenu />
          </div>
          <div className="hidden sm:block">
            <CtaLink href="#registro">Prueba gratis</CtaLink>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border xl:hidden"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-4 xl:hidden">
          <ul className="flex flex-col gap-3 text-sm font-semibold">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block py-1">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-border pt-4 sm:hidden">
            <p className="text-xs font-bold tracking-[0.18em] text-fg-3 uppercase">Entrar</p>
            <div className="mt-2 grid gap-2">
              {OPCIONES_ENTRAR.map((o) => (
                <a key={o.href} href={o.href} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                    <Icon name={o.icono} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{o.titulo}</span>
                    <span className="block text-xs text-fg-3">{o.texto}</span>
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-4">
              <CtaLink href="#registro">Prueba gratis 15 días</CtaLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
