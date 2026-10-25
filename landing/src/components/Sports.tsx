import { Reveal } from './Reveal';
import { SectionTitle } from './ui';

// Los deportes que maneja la API (enum Sport: FUTBOL, PADEL, VOLEIBOL, BALONCESTO).
const DEPORTES = [
  {
    nombre: 'Fútbol',
    titulo: 'Canchas sintéticas de fútbol',
    texto: 'Reserva cancha sintética para fútbol 5, fútbol 7 o el formato de cada club, con los horarios libres en vivo.',
    img: '/img/futbol.jpg',
    alt: 'Jugador de fútbol en cancha sintética',
  },
  {
    nombre: 'Pádel',
    titulo: 'Canchas de pádel',
    texto: 'Elige la cancha de pádel y el turno que te sirve. Sin llamar ni esperar respuesta por WhatsApp.',
    img: '/img/padel.jpg',
    alt: 'Partido en cancha de pádel',
  },
  {
    nombre: 'Vóley playa',
    titulo: 'Canchas de vóley playa',
    texto: 'Arma el partido con tu grupo y aparta la cancha de vóley playa o voleibol en segundos.',
    img: '/img/voley.jpg',
    alt: 'Partido de vóley playa',
  },
  {
    nombre: 'Baloncesto',
    titulo: 'Canchas de baloncesto',
    texto: 'Reserva la cancha de baloncesto por horas y llega directo a jugar.',
    img: '/img/basket.jpg',
    alt: 'Partido en cancha de baloncesto',
  },
];

export function Sports() {
  return (
    <section id="deportes" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionTitle
        eyebrow="Deportes"
        title="Reserva canchas de fútbol, pádel, vóley playa y baloncesto."
        lead="Busca la cancha, mira los horarios disponibles y reserva en línea. Para el jugador, siempre gratis."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {DEPORTES.map((d, i) => (
          <Reveal key={d.nombre} delay={i * 80}>
            <article className="group h-full overflow-hidden rounded-3xl border border-border bg-surface">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={d.img}
                  alt={d.alt}
                  width={512}
                  height={384}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg">
                  {d.nombre}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-extrabold">{d.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{d.texto}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
