import { useState } from 'react';
import {
  courtSpecs,
  DAY_LABELS,
  DAYS,
  formatDays,
  formatMoney,
  formatSpan,
  SPORT_EMOJI,
  SPORT_LABELS,
} from '../lib/format';
import type { PublicCourt } from '../lib/types';
import { PhotoLightbox } from './PhotoLightbox';
import { SearchIcon } from './PitchChrome';
import { ShimmerImage } from './ShimmerImage';
import { Button, Dialog } from './ui';

const PHOTO_LABELS: Record<string, string> = {
  MAIN: 'Vista general',
  SURFACE: 'Superficie',
  LIGHTING: 'Iluminación',
  EXTRA_1: 'Entorno',
  EXTRA_2: 'Otro ángulo',
};

/** Fotos, medidas, horario y precios de una cancha; se ve con o sin sesión. */
export function CourtDetails({ court, onClose }: { court: PublicCourt | null; onClose: () => void }) {
  if (!court) return null;
  return <CourtDetailsDialog key={court.id} court={court} onClose={onClose} />;
}

function CourtDetailsDialog({ court, onClose }: { court: PublicCourt; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const photo = court.photos[photoIndex];
  const specs = courtSpecs({ ...court, surfaceName: court.surface?.name ?? null });
  const turn = court.slotDuration % 60 === 0 ? `${court.slotDuration / 60} h` : `${court.slotDuration} min`;
  const facts: [string, string][] = [
    ['Deporte', `${SPORT_EMOJI[court.sport]} ${SPORT_LABELS[court.sport]}`],
    ['Tipo', court.isCovered ? 'Cubierta / con techo' : 'Al aire libre'],
    ...(court.surface ? [['Superficie', court.surface.name] as [string, string]] : []),
    ...(court.lengthMeters !== null && court.widthMeters !== null
      ? [['Medidas', `${court.lengthMeters.toLocaleString('es-CO')} × ${court.widthMeters.toLocaleString('es-CO')} m`] as [string, string]]
      : []),
    ...(court.playersPerSide !== null
      ? [
          [
            'Formato',
            court.sport === 'FUTBOL'
              ? `Fútbol ${court.playersPerSide}`
              : `${court.playersPerSide} vs ${court.playersPerSide}`,
          ] as [string, string],
        ]
      : []),
    ['Turnos de', turn],
  ];

  return (
    <Dialog open onClose={onClose} labelledBy="court-details-title" wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="court-details-title" className="text-xl font-bold">
            {court.name}
          </h2>
          {specs && <p className="mt-0.5 text-sm text-fg-2">{specs}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-fg-3 hover:bg-surface-2"
        >
          ×
        </button>
      </div>

      {photo && (
        <figure className="relative mt-4">
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={`Ampliar foto: ${PHOTO_LABELS[photo.slot] ?? 'foto'}`}
            className="group relative block w-full cursor-zoom-in rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ShimmerImage
              key={photo.url}
              src={photo.url}
              alt={`${court.name}: ${PHOTO_LABELS[photo.slot] ?? 'foto'}`}
              wrapperClassName="aspect-[4/3] max-h-[50dvh] w-full rounded-2xl"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <span
              className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full border border-hairline bg-black/60 text-white backdrop-blur-md"
              aria-hidden="true"
            >
              <SearchIcon className="size-4" />
            </span>
          </button>
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-2.5 mx-auto w-fit rounded-full border border-hairline bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            {PHOTO_LABELS[photo.slot]} · {photoIndex + 1} de {court.photos.length}
          </figcaption>
        </figure>
      )}
      {court.photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Fotos de la cancha">
          {court.photos.map((p, i) => (
            <button
              key={p.slot}
              type="button"
              aria-label={`Ver foto: ${PHOTO_LABELS[p.slot]}`}
              aria-pressed={i === photoIndex}
              onClick={() => setPhotoIndex(i)}
              className={`aspect-video w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === photoIndex ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <ShimmerImage src={p.url} alt="" wrapperClassName="size-full" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">La cancha</h3>
        <dl className="grid grid-cols-2 gap-2">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-fg-3">{label}</dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">Horario</h3>
        <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
          {DAYS.map((day) => {
            const s = court.schedules.find((x) => x.dayOfWeek === day);
            const open = s?.isOpen && s.openTime && s.closeTime;
            return (
              <li key={day} className="flex justify-between gap-4 px-4 py-2">
                <span className="font-medium">{DAY_LABELS[day]}</span>
                <span className={open ? 'tabular text-fg-2' : 'text-fg-3'}>
                  {open ? formatSpan(s.openTime!, s.closeTime!) : 'Cerrado'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">Precios por hora</h3>
        <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
          <li className="flex justify-between gap-4 px-4 py-2.5">
            <span>
              <span className="font-medium">Precio base</span>
              {court.rates.length > 0 && <span className="block text-xs text-fg-3">Fuera de las franjas</span>}
            </span>
            <span className="font-bold tabular">{formatMoney(court.basePricePerHour, court.currency)}</span>
          </li>
          {court.rates.map((r) => (
            <li key={`${r.name}-${r.startTime}`} className="flex justify-between gap-4 px-4 py-2.5">
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-fg-3">
                  {formatDays(r.days)} · {formatSpan(r.startTime, r.endTime)}
                </span>
              </span>
              <span className="font-bold tabular">{formatMoney(r.pricePerHour, court.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-3">
          El valor de cada turno ya incluye la tarifa que le corresponde. Pagas en efectivo en la sede.
        </p>
      </section>

      <Button onClick={onClose} className="mt-5 w-full">
        Ver turnos
      </Button>

      {zoom && (
        <PhotoLightbox
          photos={court.photos.map((p) => ({ url: p.url, label: `${court.name}: ${PHOTO_LABELS[p.slot] ?? 'foto'}` }))}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
          onClose={() => setZoom(false)}
        />
      )}
    </Dialog>
  );
}
