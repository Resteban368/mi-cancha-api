import { Icon } from './Icon';
import { Reveal } from './Reveal';
import { CtaLink, SectionTitle } from './ui';
import { whatsapp } from '../config';

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
          lead="Todos empiezan con 15 días de prueba gratis, sin tarjeta. Cada plan incluye agenda, panel y soporte; para los jugadores, reservar es totalmente gratis."
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

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-dashed border-accent/60 bg-surface p-6 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
            <Icon name="carrito" />
          </span>
          <div className="flex-1">
            <p className="font-extrabold">Módulo opcional: Ventas e inventario</p>
            <p className="mt-1 text-sm text-fg-2">
              Punto de venta, inventario, cuadre de caja y proveedores. Se suma a cualquier plan.{' '}
              <a href="#ventas" className="font-semibold text-accent-text underline underline-offset-2">
                Ver qué incluye
              </a>
            </p>
          </div>
          <a
            href={whatsapp('Hola, quiero saber el precio del módulo de ventas e inventario de Mi Cancha.')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold whitespace-nowrap text-accent-text"
          >
            Consultar precio →
          </a>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <CtaLink href="#registro">Prueba gratis 15 días</CtaLink>
            <CtaLink href={whatsapp('Hola, quiero contratar un plan de Mi Cancha.')} variant="ghost">
              Pedir mi plan por WhatsApp
            </CtaLink>
          </div>
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
