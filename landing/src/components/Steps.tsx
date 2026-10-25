import { Reveal } from './Reveal';
import { SectionTitle } from './ui';

import { Icon, type IconName } from './Icon';

const PASOS: { icono: IconName; titulo: string; texto: string }[] = [
  {
    icono: 'cancha',
    titulo: 'Crea tu negocio',
    texto: 'Elige departamento y ciudad, agrega tus canchas y define horarios y tarifas. La primera foto es la portada.',
  },
  {
    icono: 'whatsapp',
    titulo: 'Comparte tu link',
    texto: 'Tu página de reservas tiene su propio enlace. Ponlo en WhatsApp, Instagram o donde te escriban.',
  },
  {
    icono: 'check',
    titulo: 'Recibe y controla',
    texto: 'Los jugadores reservan solos. Tú apruebas los pagos, marcas la asistencia y ves todo en tu agenda.',
  },
];

export function Steps() {
  return (
    <section id="como" className="border-y border-border bg-surface-2/40 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Cómo funciona" title="Tres pasos y tu cancha ya recibe reservas." />

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {PASOS.map((paso, i) => (
            <Reveal key={paso.titulo} delay={i * 120}>
              <li className="h-full list-none rounded-3xl border border-border bg-surface p-7">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-extrabold text-accent-text">{i + 1}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                    <Icon name={paso.icono} />
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-extrabold">{paso.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fg-2 sm:text-base">{paso.texto}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
