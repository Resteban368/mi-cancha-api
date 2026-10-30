import { CtaLink } from './ui';
import { EXAMPLE_BOOKING_URL } from '../config';

const DEPORTES = ['Fútbol', 'Pádel', 'Vóley playa', 'Baloncesto'];

const TURNOS = [
  { hora: '18:00 – 19:00', cancha: 'Cancha 1 · Fútbol 5', estado: 'Pagó anticipado', ok: true },
  { hora: '19:00 – 20:30', cancha: 'Cancha 2 · Pádel', estado: 'Confirmada', ok: true },
  { hora: '20:30 – 21:30', cancha: 'Cancha 3 · Vóley playa', estado: 'Libre', ok: false },
];

// El hero va siempre en oscuro (tema-oscuro), aunque el resto de la página siga al sistema.
export function Hero() {
  return (
    <section className="tema-oscuro relative overflow-hidden bg-bg text-fg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[38%] h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div className="text-center lg:text-left">
          <ul className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full border border-border bg-surface/60 px-5 py-2 text-sm font-semibold text-accent-text">
            {DEPORTES.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>

          <h1 className="mt-7 text-5xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl xl:text-[4.1rem]">
            <span className="block sm:whitespace-nowrap">Tus reservas,</span>
            <span className="block text-accent sm:whitespace-nowrap">al instante.</span>
          </h1>

          <div className="mx-auto mt-7 max-w-xl space-y-4 text-base text-fg-2 sm:text-lg lg:mx-0">
            <p>La agenda de tus canchas en orden y en automático. Los jugadores reservan solos.</p>
            <p>
              Basta de anotar en un cuaderno y de contestar decenas de mensajes y llamadas. Todo en tu propia
              página.
            </p>
          </div>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="#registro"
              className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-bold whitespace-nowrap text-accent-fg shadow-[0_10px_40px_-8px_rgba(0,200,83,0.7)] transition-transform hover:-translate-y-0.5"
            >
              Crear mi negocio
            </a>
            <CtaLink href={EXAMPLE_BOOKING_URL} variant="ghost">
              Ver una página de reservas
            </CtaLink>
          </div>
          <p className="mt-6 text-sm text-fg-3">Para jugadores, siempre gratis · Desde $79.000 al mes</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="rounded-[2rem] border border-border bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-fg-3 uppercase">Agenda de hoy</p>
                <p className="mt-1 text-xl font-extrabold sm:text-2xl">Cancha El Metropolitano</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/50 px-3 py-1 text-xs font-bold text-accent-text">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                En vivo
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ['Reservas', '12'],
                ['Cobrado', '$840K'],
                ['Ocupación', '76%'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface-2 p-3 sm:p-4">
                  <p className="text-xs text-fg-3">{label}</p>
                  <p className="mt-1.5 text-xl font-extrabold sm:text-3xl">{value}</p>
                </div>
              ))}
            </div>

            <ul className="mt-6 space-y-3">
              {TURNOS.map((t) => (
                <li
                  key={t.hora}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2/40 px-4 py-4 sm:px-5"
                >
                  <div>
                    <p className="text-base font-bold sm:text-lg">{t.hora}</p>
                    <p className="text-xs text-fg-3 sm:text-sm">{t.cancha}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                      t.ok ? 'border-accent/50 bg-accent-soft text-accent-text' : 'border-border bg-surface-2 text-fg-2'
                    }`}
                  >
                    {t.estado}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-center text-xs text-fg-3">Ejemplo ilustrativo de la plataforma</p>
        </div>
      </div>
    </section>
  );
}
