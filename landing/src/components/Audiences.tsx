import { Reveal } from './Reveal';
import { SectionTitle } from './ui';

const JUGADORES = [
  'Encuentra canchas de fútbol, pádel, baloncesto y vóley playa en tu ciudad.',
  'Mira los horarios libres al instante, sin esperar a nadie.',
  'Elige tu turno y recibe la confirmación. Sin costo para ti.',
  'Entra con tu código QR y PIN, y revisa tus reservas cuando quieras.',
];

const NEGOCIOS = [
  'Crea tus canchas con horarios, tarifas y hasta 5 fotos por cancha.',
  'Tu agenda del día, con cada turno: quién llega, quién pagó y quién debe.',
  'Cartera de clientes con asistencia, saldo y última visita.',
  'Tu propio link de reservas para compartir por WhatsApp e Instagram.',
];

export function Audiences() {
  return (
    <section id="jugadores" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionTitle
        eyebrow="Un solo sistema, dos lados"
        title="Para quien juega y para quien administra."
        lead="Los jugadores reservan en segundos. Los dueños ven todo el movimiento de su club."
      />

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Reveal>
          <article id="jugadores-detalle" className="h-full rounded-3xl border border-border bg-surface p-7 sm:p-9">
            <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">Para jugadores</p>
            <h3 className="mt-3 text-2xl font-extrabold">Reserva tu cancha sin llamar a nadie.</h3>
            <ul className="mt-6 space-y-3.5">
              {JUGADORES.map((item) => (
                <Item key={item}>{item}</Item>
              ))}
            </ul>
          </article>
        </Reveal>

        <Reveal className="[transition-delay:120ms]">
          <article id="negocios" className="h-full rounded-3xl border border-accent/40 bg-accent-soft p-7 sm:p-9">
            <p className="text-xs font-bold tracking-[0.18em] text-accent-text uppercase">Para negocios</p>
            <h3 className="mt-3 text-2xl font-extrabold">Software de reservas para tu cancha.</h3>
            <ul className="mt-6 space-y-3.5">
              {NEGOCIOS.map((item) => (
                <Item key={item}>{item}</Item>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

function Item({ children }: { children: string }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-fg-2 sm:text-base">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-black text-accent-fg"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
