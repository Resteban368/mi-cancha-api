import { useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { Reveal } from './Reveal';
import { CtaLink, SectionTitle } from './ui';
import { whatsapp } from '../config';
import { formatoPesos, MAX_CANCHAS, PRECIOS } from '../precios';

const INCLUYE = [
  'Agenda en tiempo real de todas tus canchas',
  'Reservas por teléfono o en línea',
  'Tu página de reservas con link propio',
  'Pagos y aprobaciones',
  'Clientes, asistencia y saldos',
  'Métricas de tu negocio',
  'Soporte directo del equipo técnico',
];

const CANCHAS_INICIALES = 3;

export function Plans() {
  const [canchas, setCanchas] = useState(CANCHAS_INICIALES);
  const precio = PRECIOS[canchas - 1];
  const textoCanchas = canchas === 1 ? '1 cancha' : `${canchas} canchas`;

  return (
    <section id="planes" className="border-t border-border bg-surface-2/40 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <SectionTitle
          eyebrow="Precios"
          title="Un solo plan. Pagas según tus canchas."
          lead="Todo incluido desde la primera cancha y 15 días de prueba gratis, sin tarjeta. Para los jugadores, reservar es totalmente gratis."
        />

        <Reveal>
          <article className="mt-14 overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_24px_60px_-36px_rgba(11,31,40,0.45)]">
            <div className="grid md:grid-cols-[1.1fr_1fr]">
              <div className="flex flex-col p-7 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  <label htmlFor="canchas" className="text-base font-bold">
                    ¿Cuántas canchas tienes?
                  </label>
                  <div className="flex items-center rounded-full border border-border">
                    <BotonCantidad
                      etiqueta="Una cancha menos"
                      disabled={canchas === 1}
                      onClick={() => setCanchas(canchas - 1)}
                    >
                      −
                    </BotonCantidad>
                    <output htmlFor="canchas" className="w-10 text-center text-xl font-extrabold tabular-nums">
                      {canchas}
                    </output>
                    <BotonCantidad
                      etiqueta="Una cancha más"
                      disabled={canchas === MAX_CANCHAS}
                      onClick={() => setCanchas(canchas + 1)}
                    >
                      +
                    </BotonCantidad>
                  </div>
                </div>
                <input
                  id="canchas"
                  type="range"
                  min={1}
                  max={MAX_CANCHAS}
                  value={canchas}
                  onChange={(e) => setCanchas(Number(e.target.value))}
                  style={{ '--avance': (canchas - 1) / (MAX_CANCHAS - 1) } as CSSProperties}
                  className="rango-canchas mt-6"
                />
                <div className="mt-1 flex justify-between text-xs font-semibold text-fg-3" aria-hidden="true">
                  <span>1</span>
                  <span>{MAX_CANCHAS}</span>
                </div>

                <div className="mt-8 border-t border-border pt-8" aria-live="polite">
                  <p className="text-4xl font-extrabold tracking-tight whitespace-nowrap tabular-nums sm:text-5xl">
                    {formatoPesos(precio)}
                    <span className="ml-1.5 text-base font-semibold tracking-normal text-fg-3">/mes</span>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-fg-2">
                    {textoCanchas}
                    {canchas > 1 && (
                      <>
                        {' · '}
                        <span className="text-accent-text">{formatoPesos(precio / canchas)} por cancha</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-8 grid gap-3 md:mt-auto md:pt-8 [&>*]:w-full">
                  <CtaLink href="#registro">Prueba gratis 15 días</CtaLink>
                  <CtaLink
                    href={whatsapp(`Hola, quiero contratar Mi Cancha para ${textoCanchas}.`)}
                    variant="ghost"
                  >
                    Contratar por WhatsApp
                  </CtaLink>
                </div>
              </div>

              <div className="border-t border-border bg-surface-2/40 p-7 sm:p-9 md:border-l md:border-t-0">
                <h3 className="text-lg font-extrabold">Todo incluido</h3>
                <ul className="mt-5 space-y-3 text-sm text-fg-2">
                  {INCLUYE.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </Reveal>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-dashed border-accent/60 bg-surface p-6 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
            <Icon name="carrito" />
          </span>
          <div className="flex-1">
            <p className="font-extrabold">Módulo opcional: Ventas e inventario</p>
            <p className="mt-1 text-sm text-fg-2">
              Punto de venta, inventario, cuadre de caja y proveedores. Se suma a tu plan.{' '}
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

        <div className="mx-auto mt-8 max-w-xl space-y-2 text-center text-xs leading-relaxed text-fg-3">
          <p>
            ¿Más de {MAX_CANCHAS} canchas?{' '}
            <a
              href={whatsapp(`Hola, tengo más de ${MAX_CANCHAS} canchas y quiero un plan de Mi Cancha.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-accent-text underline"
            >
              Escríbenos por WhatsApp
            </a>
            .
          </p>
          <p>
            Si tu suscripción se suspende, sigues viendo toda tu información. Solo se bloquean los cambios hasta que la
            reactives.
          </p>
        </div>
      </div>
    </section>
  );
}

function BotonCantidad({
  etiqueta,
  disabled,
  onClick,
  children,
}: {
  etiqueta: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="h-11 w-11 rounded-full text-xl font-bold transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-fg-3 disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 font-black text-accent-text">
      ✓
    </span>
  );
}
