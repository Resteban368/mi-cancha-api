import type { ReactNode } from 'react';
import { Footer } from './Footer';

/** Marco de las páginas legales (términos, privacidad): header simple, título, vigencia y footer. */
export function LegalLayout({
  titulo,
  intro,
  vigencia,
  children,
}: {
  titulo: string;
  intro: ReactNode;
  vigencia: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" aria-label="Mi Cancha, inicio">
            <img src="/brand/logo-h-light.png" alt="Mi Cancha" width={198} height={36} className="h-9 w-auto dark:hidden" />
            <img
              src="/brand/logo-h-dark.png"
              alt=""
              aria-hidden="true"
              width={198}
              height={36}
              className="hidden h-9 w-auto dark:block"
            />
          </a>
          <a href="/" className="text-sm font-semibold text-fg-2 hover:text-fg">
            ← Volver al inicio
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <article className="text-[15px] leading-relaxed text-fg-2">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">Legal</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-fg">{titulo}</h1>
          <p className="mt-4 text-base">{intro}</p>
          <p className="mt-3 text-sm text-fg-3">Vigente desde el {vigencia}.</p>
          {children}
        </article>
      </main>

      <Footer />
    </>
  );
}

export function Seccion({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3 [&_a]:font-semibold [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h2 className="text-xl font-extrabold text-fg">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  );
}
