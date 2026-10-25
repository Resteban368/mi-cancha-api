import { Icon, type IconName } from './Icon';
import { Reveal } from './Reveal';
import { SectionTitle } from './ui';

const FEATURES: { icono: IconName; titulo: string; texto: string }[] = [
  {
    icono: 'calendario',
    titulo: 'Agenda en tiempo real',
    texto: 'Turnos del día de todas tus canchas, con su estado: libre, reservado o pasado.',
  },
  {
    icono: 'reloj',
    titulo: 'Reservas por teléfono o en línea',
    texto: 'Reserva tú en nombre del cliente o deja que él lo haga. Hasta 5 turnos seguidos de una vez.',
  },
  {
    icono: 'pagos',
    titulo: 'Pagos y aprobaciones',
    texto: 'Registra los pagos o apruébalos cuando lleguen. Si cancelas, se devuelve lo cobrado.',
  },
  {
    icono: 'clientes',
    titulo: 'Clientes y saldos',
    texto: 'Ficha de cada cliente con asistencia, cuánto ha invertido y si debe algo.',
  },
  {
    icono: 'grafica',
    titulo: 'Métricas de tu negocio',
    texto: 'Ocupación, días y horas con más movimiento, métodos de pago y top de clientes.',
  },
  {
    icono: 'link',
    titulo: 'Tu página de reservas',
    texto: 'Un link propio con tu portada, tus canchas y sus horarios disponibles para cualquiera.',
  },
];

export function Features() {
  return (
    <section id="incluye" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionTitle
        eyebrow="Qué incluye"
        title="Un sistema de reservas para canchas, completo."
        lead="Lo que necesitas para llenar tus canchas sintéticas, de pádel o de vóley, y tener el negocio ordenado."
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.titulo} delay={(i % 3) * 80}>
            <article className="h-full rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/60">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <Icon name={f.icono} />
              </span>
              <h3 className="text-lg font-extrabold">{f.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-2">{f.texto}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
