import { CtaLink } from './ui';
import { PANEL_URL, WHATSAPP_URL } from '../config';

export function Footer() {
  return (
    <>
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-accent px-6 py-14 text-center text-accent-fg sm:px-12">
          <h2 className="text-3xl leading-tight font-extrabold sm:text-4xl">Tu cancha, llena y ordenada.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base">
            Crea tu negocio desde el navegador, agrega tus canchas y comparte tu link de reservas hoy mismo.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaLink href={PANEL_URL}>Crear mi negocio</CtaLink>
            <CtaLink href={WHATSAPP_URL} variant="ghost">
              Hablar por WhatsApp
            </CtaLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-fg-3 sm:flex-row">
          <img src="/brand/logo-h-light.png" alt="Mi Cancha" width={198} height={36} className="h-9 w-auto dark:hidden" />
          <img
            src="/brand/logo-h-dark.png"
            alt="Mi Cancha"
            width={198}
            height={36}
            className="hidden h-9 w-auto dark:block"
          />
          <ul className="flex gap-6 font-semibold">
            <li>
              <a href="#como" className="hover:text-fg">
                Cómo funciona
              </a>
            </li>
            <li>
              <a href="#planes" className="hover:text-fg">
                Planes
              </a>
            </li>
            <li>
              <a href="#preguntas" className="hover:text-fg">
                Preguntas
              </a>
            </li>
          </ul>
          <p>© {new Date().getFullYear()} Mi Cancha</p>
        </div>
      </footer>
    </>
  );
}
