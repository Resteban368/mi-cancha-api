import type { ReactNode } from 'react';

/** Botón principal. Sin URL se muestra deshabilitado (ver src/config.ts). */
export function CtaLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5';
  const style =
    variant === 'primary'
      ? 'bg-accent text-accent-fg shadow-[0_8px_30px_-8px_rgba(0,200,83,0.55)]'
      : 'border border-border text-fg hover:bg-surface-2';

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`${base} ${style} cursor-not-allowed opacity-50`}
        title="Enlace pendiente de configurar"
      >
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={`${base} ${style}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">{children}</p>
  );
}

export function SectionTitle({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {lead && <p className="mt-4 text-base text-fg-2 sm:text-lg">{lead}</p>}
    </div>
  );
}
