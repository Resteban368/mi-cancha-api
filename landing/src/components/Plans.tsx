import { useState } from 'react';
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
          <article className="mt-14 overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="grid md:grid-cols-2">
              <div className="flex flex-col p-7 sm:p-9">
                <label htmlFor="canchas" className="text-sm font-bold">
                  ¿Cuántas canchas tienes?
                </label>
                <div className="mt-4 flex items-center gap-4">
                  <BotonCantidad
                    etiqueta="Una cancha menos"
                    disabled={canchas === 1}
                    onClick={() => setCanchas(canchas - 1)}
                  >
                    −
                  </BotonCantidad>
                  <output htmlFor="canchas" className="min-w-12 text-center text-4xl font-extrabold tabular-nums">
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
                <input
                  id="canchas"
                  type="range"
                  min={1}
                  max={MAX_CANCHAS}
                  value={canchas}
                  onChange={(e) => setCanchas(Number(e.target.value))}
                  className="mt-6 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-xs text-fg-3" aria-hidden="true">
                  <span>1</span>
                  <span>{MAX_CANCHAS}</span>
                </div>

                <p className="mt-8 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl" aria-live="polite">
                  {formatoPesos(precio)}
                  <span className="ml-1 text-sm font-semibold tracking-normal text-fg-3">/mes</span>
                </p>
                <p className="mt-2 text-sm font-semibold text-fg-2">
                  {textoCanchas}
                  {canchas > 1 && ` · ${formatoPesos(precio / canchas)} por cancha`}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-auto md:pt-8">
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
      className="h-11 w-11 rounded-full border border-border text-xl font-bold transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
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
