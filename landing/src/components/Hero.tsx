import { CtaLink } from './ui';
import { EXAMPLE_BOOKING_URL, PANEL_URL } from '../config';

const TURNOS = [
  { hora: '18:00 – 19:00', cancha: 'Cancha 1 · Fútbol 5', estado: 'Pagó anticipo', ok: true },
  { hora: '19:00 – 20:30', cancha: 'Cancha 2 · Pádel', estado: 'Confirmada', ok: true },
  { hora: '20:30 – 21:30', cancha: 'Cancha 3 · Vóley playa', estado: 'Libre', ok: false },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-fg-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Fútbol · Pádel · Vóley playa · Baloncesto
          </span>

          <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Reserva tu cancha
            <span className="block text-accent-text">al instante.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-fg-2 sm:text-lg lg:mx-0">
            Reserva canchas sintéticas de fútbol, pádel y vóley playa en línea, gratis para el jugador. Y si tienes
            canchas, ves la agenda, los clientes y los cobros en un solo lugar, sin cuaderno ni WhatsApp a toda hora.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <CtaLink href={PANEL_URL}>Crear mi negocio</CtaLink>
            <CtaLink href={EXAMPLE_BOOKING_URL} variant="ghost">
              Ver una página de reservas
            </CtaLink>
          </div>
          <p className="mt-4 text-xs text-fg-3">Para jugadores, siempre gratis · Planes desde $69.000 al mes</p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-fg-3">Agenda de hoy</p>
                <p className="text-lg font-extrabold">Mi Cancha Centro</p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-text">En vivo</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['Reservas', '12'],
                ['Cobrado', '$840K'],
                ['Ocupación', '76%'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-[11px] font-semibold text-fg-3">{label}</p>
                  <p className="mt-1 text-base font-extrabold">{value}</p>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-2.5">
              {TURNOS.map((t) => (
                <li key={t.hora} className="flex items-center justify-between rounded-2xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-bold">{t.hora}</p>
                    <p className="text-xs text-fg-3">{t.cancha}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      t.ok ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-fg-2'
                    }`}
                  >
                    {t.estado}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-center text-[11px] text-fg-3">Ejemplo ilustrativo de la plataforma</p>
        </div>
      </div>
    </section>
  );
}
