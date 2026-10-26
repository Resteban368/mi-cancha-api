import { CtaLink } from './ui';
import { POLICY_URL, WHATSAPP_URL } from '../config';

export function Footer() {
  return (
    <>
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-accent px-6 py-14 text-center text-accent-fg sm:px-12">
          <h2 className="text-3xl leading-tight font-extrabold sm:text-4xl">Tu cancha, llena y ordenada.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base">
            Crea tu negocio desde el navegador y pruébalo 15 días gratis: sin tarjeta, hasta 2 canchas y todo el panel.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {/* Sobre el fondo verde el botón principal va en negro azulado para que se vea. */}
            <a
              href="/#registro"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#0b1f28] px-6 py-3 text-sm font-bold text-[#f8fafc] transition-transform hover:-translate-y-0.5"
            >
              Prueba gratis 15 días
            </a>
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
          {/* Con "/" delante para que también funcionen desde /terminos. */}
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-semibold">
            {[
              ['/#como', 'Cómo funciona'],
              ['/#planes', 'Planes'],
              ['/#preguntas', 'Preguntas'],
              ['/terminos/', 'Términos y condiciones'],
              [POLICY_URL, 'Política de datos'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <p>© {new Date().getFullYear()} Mi Cancha</p>
        </div>
      </footer>
    </>
  );
}
