import { PREGUNTAS } from '../faq';
import { SectionTitle } from './ui';

// <details> deja las respuestas en el HTML (las lee Google) y abre y cierra sin JavaScript.
export function Faq() {
  return (
    <section id="preguntas" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <SectionTitle eyebrow="Preguntas" title="Preguntas frecuentes sobre reservar canchas." />

      <div className="mt-12 divide-y divide-border rounded-3xl border border-border bg-surface">
        {PREGUNTAS.map((item, i) => (
          <details key={item.p} open={i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-bold [&::-webkit-details-marker]:hidden">
              <h3 className="text-base">{item.p}</h3>
              <span aria-hidden="true" className="text-xl text-accent-text transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="px-6 pb-5 text-sm leading-relaxed text-fg-2">{item.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
