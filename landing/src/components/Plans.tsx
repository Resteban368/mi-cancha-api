import { Reveal } from './Reveal';
import { CtaLink, SectionTitle } from './ui';
import { WHATSAPP_URL } from '../config';

const PLANES = [
  { nombre: 'Básico', canchas: 1, precio: '$ 69.000', porCancha: null, destacado: false },
  { nombre: 'Dúo', canchas: 2, precio: '$ 109.000', porCancha: '$ 54.500', destacado: false },
  { nombre: 'Plus', canchas: 5, precio: '$ 159.000', porCancha: '$ 31.800', destacado: false },
  { nombre: 'Pro', canchas: 10, precio: '$ 209.000', porCancha: '$ 20.900', destacado: false },
];

const INCLUYE = [
  'Agenda digital automática',
  'Panel de negocio con estadísticas',
  'Soporte: asistencia directa del equipo técnico',
];

export function Plans() {
  return (
    <section id="planes" className="border-t border-border bg-surface-2/40 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Planes"
          title="Planes según cuántas canchas tienes."
          lead="Todos los planes incluyen agenda, panel y soporte. Para los jugadores, reservar es totalmente gratis."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANES.map((plan, i) => (
            <Reveal key={plan.nombre} delay={i * 80}>
              <article
                className={`flex h-full flex-col rounded-3xl border p-7 ${
                  plan.destacado ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold">{plan.nombre}</h3>
                  {plan.destacado && (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg">
                      Más elegido
                    </span>
                  )}
                </div>

                <p className="mt-5 text-3xl font-extrabold tracking-tight">
                  {plan.precio}
                  <span className="ml-1 text-sm font-semibold text-fg-3">/mes</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-fg-2">
                  Hasta {plan.canchas} {plan.canchas === 1 ? 'cancha activa' : 'canchas activas'}
                </p>

                <ul className="mt-6 space-y-3 border-t border-border pt-6 text-sm text-fg-2">
                  {plan.porCancha && (
                    <li className="flex gap-2.5">
                      <Check />
                      <span>
                        Costo por cancha: <strong className="text-fg">{plan.porCancha}</strong>
                      </span>
                    </li>
                  )}
                  {INCLUYE.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <CtaLink href={WHATSAPP_URL}>Pedir mi plan por WhatsApp</CtaLink>
          <p className="max-w-xl text-xs leading-relaxed text-fg-3">
            Si tu suscripción se suspende, sigues viendo toda tu información. Solo se bloquean los cambios hasta que la
            reactives.
          </p>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 font-black text-accent-text">
      ✓
    </span>
  );
}
