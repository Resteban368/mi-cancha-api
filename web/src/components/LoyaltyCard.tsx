import { useState } from 'react';
import { Link } from 'react-router';
import type { PlayerCoupon } from '../lib/types';

const stampDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const expiryDate = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

function progressLabel(card: PlayerCoupon): string {
  if (card.status === 'EARNED') return '¡Tu bono está listo!';
  return card.remaining === 1 ? '¡Falta solo 1 reserva!' : `Faltan ${card.remaining} reservas`;
}

/** Cupón que se voltea: al frente el premio y el avance; atrás la cartilla de sellos. */
export function LoyaltyCard({ card }: { card: PlayerCoupon }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((value) => !value);

  return (
    <div className="flip-perspective h-[510px] w-full">
      <div className={`flip-inner cursor-pointer ${flipped ? 'is-flipped' : ''}`} onClick={toggle}>
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
  const percent = Math.min(100, (card.completed / card.required) * 100);
  const near = earned || card.remaining === 1;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative flex h-full flex-col justify-between rounded-[1.25rem] bg-gradient-to-b from-brand-surface to-[#0a181e] p-6 text-slate-100 shadow-lg shadow-black/40 ${
        near ? 'border-2 border-brand-neon/40' : 'border border-brand-border'
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-brand-neon/10 blur-3xl" />
      <div className="relative min-h-0">
        {card.businessSlug ? (
          <Link
            to={`/${card.businessSlug}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-block max-w-full truncate rounded-full border border-brand-neon/20 bg-brand-neon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-neon hover:border-brand-neon"
          >
            {card.businessName}
          </Link>
        ) : (
          <span className="inline-block max-w-full truncate rounded-full border border-brand-neon/20 bg-brand-neon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-neon">
            {card.businessName}
          </span>
        )}

        <div className="relative mt-4 flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-brand-border/60 bg-gradient-to-tr from-brand-dark via-brand-surface-light to-[#122e3b]">
          {card.imageUrl && !imageFailed ? (
            <img
              src={card.imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#00e599_1px,transparent_1px)] opacity-15 [background-size:16px_16px]" />
              <div className="z-10 rounded-2xl border border-brand-neon/30 bg-brand-teal/30 p-3">
                <TicketIcon className="size-9 text-brand-lime" />
              </div>
            </>
          )}
        </div>

        <h2 className="mt-4 truncate text-2xl font-bold tracking-tight text-white">{card.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-slate-300">{card.rewardDescription}</p>
        <p className="mt-2 text-xs font-medium text-brand-neon">
          {card.expiresAt ? `Válido hasta el ${expiryDate.format(new Date(card.expiresAt))}` : 'Sin vencimiento'}
        </p>
      </div>

      <div className="relative mt-4 border-t border-brand-border/60 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
          <span className={`flex items-center gap-1.5 ${near ? 'text-brand-lime' : 'text-slate-200'}`}>
            <BoltIcon className="size-3.5 shrink-0" />
            {progressLabel(card)}
          </span>
          <span className="shrink-0 text-sm tabular-nums tracking-wide text-slate-300">
            {card.completed} de {card.required}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Reservas de ${card.name}`}
          aria-valuemin={0}
          aria-valuemax={card.required}
          aria-valuenow={card.completed}
          className="h-3 w-full overflow-hidden rounded-full border border-brand-border bg-brand-surface-light p-0.5"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-teal via-brand-neon to-brand-lime shadow-[0_0_20px_-3px_rgba(0,229,153,0.4)]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 min-h-4 text-xs text-slate-300">
          {earned ? 'Pídelo en la sede cuando vayas a pagar tu reserva.' : ''}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFlip();
            }}
            className="flex items-center gap-1 rounded text-xs font-semibold text-brand-neon transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-neon"
          >
            Ver cartilla de sellos
            <ChevronIcon className="size-3.5" />
          </button>
          <span className="text-[11px] text-slate-400">Toca para voltear</span>
        </div>
      </div>
    </div>
  );
}

function Back({ card, onFlip }: { card: PlayerCoupon; onFlip: () => void }) {
  const few = card.required <= 3;
  const slots = Array.from({ length: card.required }, (_, i) => i);

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-[1.25rem] border-2 border-brand-lime bg-gradient-to-b from-[#0c222b] to-[#071318] p-5 text-slate-100 shadow-2xl sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-brand-border pb-3">
          <div className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wider text-brand-lime">Cartilla de sellos</span>
            <h3 className="truncate text-lg font-bold text-white">{card.name}</h3>
            <p className="truncate text-xs text-slate-400">{card.businessName}</p>
          </div>
          <button
            type="button"
            aria-label="Voltear al frente"
            onClick={(event) => {
              event.stopPropagation();
              onFlip();
            }}
            className="shrink-0 rounded-lg bg-brand-surface-light p-1.5 text-slate-300 transition hover:bg-brand-teal hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lime"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <p className="mb-2 mt-3 text-[11px] text-slate-400">
          Se llena un sello por cada reserva jugada y pagada.
        </p>
        <ul
          className={`grid min-h-0 flex-1 content-start overflow-y-auto pr-0.5 ${few ? 'grid-cols-3 gap-3' : 'grid-cols-5 gap-2 sm:gap-2.5'}`}
          aria-label={`${card.completed} de ${card.required} sellos`}
        >
          {slots.map((i) => {
            const stamp = card.stamps[i];
            const goal = i === card.required - 1;
            if (stamp) {
              return (
                <li
                  key={i}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-brand-teal bg-brand-surface p-1 text-center"
                >
                  <span className="text-[10px] font-bold text-brand-neon">#{i + 1}</span>
                  <CheckIcon className="size-4 text-brand-lime" />
                  <span className="text-[9px] leading-tight text-slate-400">
                    {stampDate.format(new Date(stamp.playedAt))}
                  </span>
                </li>
              );
            }
            return (
              <li
                key={i}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl p-1 text-center ${
                  goal
                    ? 'border-2 border-dashed border-brand-lime bg-brand-lime/10 motion-safe:animate-pulse'
                    : 'border border-dashed border-brand-border'
                }`}
              >
                <span className={`text-[10px] font-bold ${goal ? 'text-brand-lime' : 'text-slate-500'}`}>#{i + 1}</span>
                {goal ? (
                  <>
                    <TrophyIcon className="size-5 text-brand-lime" />
                    <span className="text-[9px] font-bold uppercase text-brand-lime">¡Meta!</span>
                  </>
                ) : (
                  <span className="sr-only">Pendiente</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onFlip();
        }}
        className="w-full shrink-0 rounded-xl bg-brand-lime py-2.5 text-xs font-bold uppercase tracking-wider text-brand-dark shadow-lg shadow-brand-lime/20 transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        ↺ Volver a la portada del cupón
      </button>
    </div>
  );
}

type IconProps = { className?: string };

const TicketIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-4V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Zm11-4v2m0 4v2m0 4v2" />
  </svg>
);
const BoltIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const ChevronIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const CheckIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" />
  </svg>
);
const TrophyIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
);
