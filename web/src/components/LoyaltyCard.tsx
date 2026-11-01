import { useState } from 'react';
import { Link } from 'react-router';
import { SPORT_LABELS } from '../lib/format';
import type { PlayerCoupon, Sport } from '../lib/types';

const stampDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const expiryDate = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

function progressLabel(card: PlayerCoupon): string {
  if (card.status === 'EARNED') return '¡Tu premio está listo!';
  return card.remaining === 1 ? '¡Falta solo 1 reserva!' : `Faltan ${card.remaining} reservas`;
}

const TONES = {
  neon: {
    pill: 'border-pass-neon/20 bg-pass-neon/10 text-pass-neon hover:bg-pass-neon/20',
    dot: 'bg-pass-neon',
    icon: 'border-pass-neon/30 bg-pass-teal/30 text-pass-lime',
    bar: 'from-pass-teal to-pass-neon',
    text: 'text-pass-neon',
    stampBorder: 'border-pass-teal',
    stampIcon: 'text-pass-lime',
    goal: 'border-pass-neon bg-pass-neon/10',
    back: 'border-pass-neon',
    solid: 'bg-pass-neon shadow-pass-neon/20',
  },
  lime: {
    pill: 'border-pass-lime/20 bg-pass-lime/10 text-pass-lime hover:bg-pass-lime/20',
    dot: 'bg-pass-lime',
    icon: 'border-pass-lime/30 bg-pass-lime/20 text-pass-lime',
    bar: 'from-pass-neon to-pass-lime',
    text: 'text-pass-lime',
    stampBorder: 'border-pass-teal',
    stampIcon: 'text-pass-lime',
    goal: 'border-pass-lime bg-pass-lime/10',
    back: 'border-pass-lime',
    solid: 'bg-pass-lime shadow-pass-lime/20',
  },
  cyan: {
    pill: 'border-pass-cyan/20 bg-pass-cyan/10 text-pass-cyan hover:bg-pass-cyan/20',
    dot: 'bg-pass-cyan',
    icon: 'border-pass-cyan/30 bg-pass-cyan/20 text-pass-cyan',
    bar: 'from-pass-teal to-pass-cyan',
    text: 'text-pass-cyan',
    stampBorder: 'border-pass-cyan/50',
    stampIcon: 'text-pass-cyan',
    goal: 'border-pass-cyan bg-pass-cyan/10',
    back: 'border-pass-cyan',
    solid: 'bg-pass-cyan shadow-pass-cyan/20',
  },
};

/** Cada sede conserva su color, como en el diseño: mismo nombre, mismo tono en todas las vistas. */
function toneOf(businessName: string) {
  const sum = [...businessName].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sum % 2 === 0 ? TONES.neon : TONES.cyan;
}

const isNear = (card: PlayerCoupon) => card.status === 'EARNED' || card.remaining === 1;

/** Cupón interactivo con Flip 3D: portada con avance y reverso con cartilla de sellos. */
export function LoyaltyCard({ card }: { card: PlayerCoupon }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((prev) => !prev);

  return (
    <div className="flip-perspective h-[510px] w-full">
      <div
        className={`flip-inner cursor-pointer ${flipped ? 'is-flipped' : ''}`}
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-label={`${card.name} en ${card.businessName}. ${flipped ? 'Cartilla de sellos abierta' : 'Portada del cupón'}. Toca para voltear.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div inert={flipped} className="flip-face">
          <Front card={card} onFlip={toggle} />
        </div>
        <div inert={!flipped} className="flip-face flip-face-back">
          <Back card={card} onFlip={toggle} />
        </div>
      </div>
    </div>
  );
}

function Front({ card, onFlip }: { card: PlayerCoupon; onFlip: () => void }) {
  const earned = card.status === 'EARNED';
  const near = isNear(card);
  const tone = toneOf(card.businessName);
  const percent = Math.min(100, Math.round((card.completed / Math.max(1, card.required)) * 100));
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(card.imageUrl) && !imageFailed;
  const pill = `min-w-0 rounded-2xl border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${tone.pill}`;

  return (
    <div
      className={`relative flex h-full select-none flex-col justify-between overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-pass-surface to-[#0a181e] p-5 text-slate-100 transition-colors sm:p-6 ${
        near ? 'border-2 border-pass-neon/40 hover:border-pass-neon' : 'border border-pass-border hover:border-pass-neon/60'
      }`}
    >
      {near && (
        <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-pass-neon/10 blur-3xl" />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex items-start justify-between gap-2">
          {card.businessSlug ? (
            <Link to={`/${card.businessSlug}`} onClick={(e) => e.stopPropagation()} className={pill}>
              {near && <span className={`mr-1.5 inline-block size-1.5 rounded-full align-middle animate-ping ${tone.dot}`} />}
              {card.businessName}
            </Link>
          ) : (
            <span className={pill}>{card.businessName}</span>
          )}
          <span className="shrink-0 rounded border border-pass-border bg-pass-raised px-2 py-0.5 text-[11px] font-medium text-slate-400">
            {earned ? '¡Listo!' : 'En curso'}
          </span>
        </div>

        <div className="relative mb-4 flex max-h-36 min-h-16 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-pass-border/60 bg-gradient-to-tr from-pass-dark via-pass-raised to-[#122e3b]">
          {hasImage ? (
            <img
              src={card.imageUrl ?? undefined}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#00e599_1px,transparent_1px)] opacity-15 [background-size:16px_16px]" />
              <div className="relative z-10 px-4 text-center">
                <div className={`mb-2 inline-block rounded-2xl border p-2 ${tone.icon}`}>
                  <SoccerBallIcon className="size-8" />
                </div>
                <p className="font-display line-clamp-2 text-xl font-bold uppercase leading-tight tracking-wide text-white">
                  {card.rewardDescription}
                </p>
              </div>
            </>
          )}
        </div>

        <h2 className="truncate text-2xl font-bold tracking-tight text-white">{card.name}</h2>
        <p className="mt-1 line-clamp-2 text-xs text-slate-300 sm:text-sm">
          {hasImage
            ? card.rewardDescription
            : `Canjea este bono con ${card.required} ${card.required === 1 ? 'reserva completada' : 'reservas completadas'} en ${card.businessName}.`}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {card.expiresAt ? (
            <span className="font-medium text-amber-400">Vence: {expiryDate.format(new Date(card.expiresAt))}</span>
          ) : (
            <span className="font-medium text-pass-neon">Sin vencimiento</span>
          )}
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Canjeable en caja</span>
        </div>
      </div>

      <div className="relative mt-4 border-t border-pass-border/60 pt-3">
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1.5 text-pass-lime">
            <BoltIcon className="size-3.5 shrink-0" />
            {progressLabel(card)}
          </span>
          <span className="font-display text-sm tracking-wide text-slate-300">
            {card.completed} de {card.required}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Progreso de ${card.name}`}
          aria-valuemin={0}
          aria-valuemax={card.required}
          aria-valuenow={card.completed}
          className="h-3 w-full overflow-hidden rounded-full border border-pass-border bg-pass-raised p-0.5"
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
              near && tone === TONES.neon ? 'from-pass-teal via-pass-neon to-pass-lime shadow-[0_0_20px_-3px_rgba(0,229,153,0.4)]' : tone.bar
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFlip();
            }}
            className={`flex items-center gap-1 text-xs font-semibold transition hover:text-white ${tone.text}`}
          >
            Ver cartilla de sellos
            <ChevronIcon className="size-3.5" />
          </button>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            Toca para voltear
            <RotateIcon className="size-3.5 text-pass-lime" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Back({ card, onFlip }: { card: PlayerCoupon; onFlip: () => void }) {
  const slots = Array.from({ length: card.required }, (_, i) => i);
  const few = card.required <= 3;
  const base = toneOf(card.businessName);
  const tone = base === TONES.neon && isNear(card) ? TONES.lime : base;
  const flip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFlip();
  };

  return (
    <div
      className={`flex h-full select-none flex-col justify-between rounded-[1.25rem] border-2 bg-gradient-to-b from-[#0c222b] to-[#071318] p-5 text-slate-100 sm:p-6 ${tone.back}`}
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-pass-border pb-3">
          <div className="min-w-0">
            <span className={`block text-xs font-bold uppercase tracking-wider ${tone.text}`}>Cartilla de sellos</span>
            <h3 className="truncate text-lg font-bold text-white">{card.name}</h3>
            <p className="text-xs text-slate-400">{card.businessName}</p>
          </div>
          <button
            type="button"
            aria-label="Voltear al frente"
            onClick={flip}
            className="shrink-0 rounded-lg bg-pass-raised p-1.5 text-slate-300 transition hover:bg-pass-teal hover:text-white"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <p className="mb-2 mt-3 text-[11px] text-slate-400">Recibes 1 sello por cada reserva jugada y confirmada en la sede:</p>

        <ul
          className={`no-scrollbar grid min-h-0 content-start overflow-y-auto ${few ? 'grid-cols-3 gap-3' : 'grid-cols-5 gap-2'}`}
          aria-label={`${card.completed} de ${card.required} sellos acumulados`}
        >
          {slots.map((i) => {
            const stamp = card.stamps[i];
            const isGoal = i === card.required - 1;

            if (stamp) {
              return (
                <li
                  key={i}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border bg-pass-surface p-1 text-center ${tone.stampBorder}`}
                >
                  <span className={`text-[10px] font-bold ${tone.text}`}>#{i + 1}</span>
                  {stamp.sport ? (
                    <SportIcon sport={stamp.sport} className={`${few ? 'size-8' : 'size-5'} ${tone.stampIcon}`} />
                  ) : (
                    <CheckIcon className={`${few ? 'size-8' : 'size-5'} ${tone.stampIcon}`} />
                  )}
                  <span className="max-w-full truncate text-[8px] text-slate-400">
                    {stampDate.format(new Date(stamp.playedAt))}
                  </span>
                </li>
              );
            }

            if (isGoal) {
              return (
                <li
                  key={i}
                  className={`flex aspect-square animate-pulse flex-col items-center justify-center rounded-xl border-2 border-dashed p-1 text-center ${tone.goal}`}
                >
                  <span className={`text-[10px] font-black ${tone.text}`}>#{i + 1}</span>
                  <TrophyIcon className={`size-5 ${tone.text}`} />
                  <span className={`text-[8px] font-bold uppercase ${tone.text}`}>¡Meta!</span>
                </li>
              );
            }

            return (
              <li
                key={i}
                className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-pass-border p-1 text-center"
              >
                <span className="text-[10px] font-bold text-slate-500">#{i + 1}</span>
                <SoccerBallIcon className="size-4 text-slate-600" />
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={flip}
        className={`mt-3 w-full shrink-0 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider text-pass-dark shadow-lg transition hover:opacity-95 ${tone.solid}`}
      >
        ↺ Volver a la portada del cupón
      </button>
    </div>
  );
}

type IconProps = { className?: string };

const BoltIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ChevronIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
  </svg>
);

const RotateIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const SoccerBallIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <polygon points="12 8 15 10 14 14 10 14 9 10" />
    <line x1="12" y1="8" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="15" y1="10" x2="20" y2="7" stroke="currentColor" strokeWidth="1.5" />
    <line x1="14" y1="14" x2="19" y2="18" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10" y1="14" x2="5" y2="18" stroke="currentColor" strokeWidth="1.5" />
    <line x1="9" y1="10" x2="4" y2="7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const TrophyIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
);

const SPORT_PATHS: Record<Sport, React.ReactNode> = {
  FUTBOL: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m12 7.5 4.3 3.1-1.6 5h-5.4l-1.6-5L12 7.5ZM12 7.5V2.5M16.3 10.6l4.7-1.6M14.7 15.6l2.9 4M9.3 15.6l-2.9 4M7.7 10.6 3 9" />
    </>
  ),
  PADEL: (
    <>
      <path d="M15 2.5a6.5 6.5 0 0 1 4.6 11.1c-2.2 2.2-5.6 2.5-8 .9-1.6-2.4-1.3-5.8.9-8A6.5 6.5 0 0 1 15 2.5Z" />
      <path d="M11.6 14.5 4 22 2 20l7.5-7.6M12 8.5l5.5 5.5M15 6l3.5 3.5" />
    </>
  ),
  BALONCESTO: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5v19M5.3 5.3a9.5 9.5 0 0 1 0 13.4M18.7 5.3a9.5 9.5 0 0 0 0 13.4" />
    </>
  ),
  VOLEIBOL: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 12V2.5M12 12l8.2 4.8M12 12l-8.2 4.8M12 6.5c3.5.3 6.8 2.2 9 5.3M8.5 15c-1.5-3.2-1.6-7 0-11.8M15.5 15c-2 2.9-5.2 4.9-9.3 6" />
    </>
  ),
};

const SportIcon = ({ sport, className }: IconProps & { sport: Sport }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={SPORT_LABELS[sport]} className={className}>
    {SPORT_PATHS[sport]}
  </svg>
);
