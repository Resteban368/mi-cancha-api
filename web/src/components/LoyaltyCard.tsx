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
  if (card.status === 'EARNED') return '¡Tu premio está listo!';
  return card.remaining === 1 ? '¡Falta solo 1 reserva!' : `Faltan ${card.remaining} reservas`;
}

/** Cupón interactivo con Flip 3D: portada con avance y reverso con cartilla de sellos. */
export function LoyaltyCard({ card }: { card: PlayerCoupon }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((prev) => !prev);

  return (
    <div className="flip-perspective h-[450px] w-full">
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
          <Front card={card} />
        </div>
        <div inert={!flipped} className="flip-face flip-face-back">
          <Back card={card} onFlip={toggle} />
        </div>
      </div>
    </div>
  );
}

function Front({ card }: { card: PlayerCoupon }) {
  const earned = card.status === 'EARNED';
  const percent = Math.min(100, Math.round((card.completed / Math.max(1, card.required)) * 100));
  const near = earned || card.remaining === 1;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative flex h-full flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all select-none ${
        earned
          ? 'border-accent/60 bg-gradient-to-br from-accent/15 via-surface to-surface-2 shadow-lg shadow-accent/10'
          : near
            ? 'border-accent/40 bg-surface shadow-md'
            : 'border-hairline bg-surface shadow-sm'
      }`}
    >
      {/* Glow decorativo sutil */}
      {near && (
        <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-accent/15 blur-2xl" />
      )}

      <div className="relative min-h-0 space-y-3">
        {/* Cabecera: Sede y Badge de Estado */}
        <div className="flex items-center justify-between gap-2">
          {card.businessSlug ? (
            <Link
              to={`/${card.businessSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-[65%] items-center gap-1 truncate rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent-text hover:border-accent hover:bg-accent/20 transition-all"
            >
              <span className="truncate">{card.businessName}</span>
            </Link>
          ) : (
            <span className="inline-flex max-w-[65%] items-center gap-1 truncate rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-fg-2">
              <span className="truncate">{card.businessName}</span>
            </span>
          )}

          {earned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent-fg shadow-glow-accent animate-pulse">
              <SparklesIcon className="size-3" />
              ¡Listo!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-fg-3">
              {card.completed}/{card.required} sellos
            </span>
          )}
        </div>

        {/* Imagen del Cupón o Banner Ilustrado */}
        <div className="relative flex h-28 sm:h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-2">
          {card.imageUrl && !imageFailed ? (
            <img
              src={card.imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent-text shadow-sm">
                <TicketIcon className="size-6 font-bold" />
              </div>
              <span className="text-[11px] font-semibold text-fg-3">Club de Fidelización</span>
            </div>
          )}
        </div>

        {/* Título y Beneficio */}
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-fg truncate">
            {card.name}
          </h2>
          <p className="mt-0.5 text-xs text-fg-2 line-clamp-2 leading-relaxed">
            {card.rewardDescription}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-fg-3">
            {card.expiresAt ? `Vence el ${expiryDate.format(new Date(card.expiresAt))}` : 'Sin fecha de vencimiento'}
          </p>
        </div>
      </div>

      {/* Barra de Progreso y Acción Flip */}
      <div className="relative mt-3 border-t border-hairline pt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
          <span className={`flex items-center gap-1.5 ${near ? 'text-accent-text' : 'text-fg-2'}`}>
            <BoltIcon className="size-3.5 shrink-0" />
            {progressLabel(card)}
          </span>
          <span className="text-xs font-semibold tabular-nums text-fg-3">
            {percent}%
          </span>
        </div>

        {/* Barra animada */}
        <div
          role="progressbar"
          aria-label={`Progreso de ${card.name}`}
          aria-valuemin={0}
          aria-valuemax={card.required}
          aria-valuenow={card.completed}
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 border border-hairline p-0.5"
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 shadow-glow-accent"
            style={{ width: `${percent}%` }}
          />
        </div>

        {earned && (
          <p className="mt-2 text-center text-[11px] font-semibold text-accent-text">
            🎁 Canjea este premio en caja al llegar a tu partido.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-text hover:underline">
            <span>Ver sellos</span>
            <RotateIcon className="size-3.5" />
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[10px] font-medium text-fg-3">
            Toca para voltear ↺
          </span>
        </div>
      </div>
    </div>
  );
}

function Back({ card, onFlip }: { card: PlayerCoupon; onFlip: () => void }) {
  const slots = Array.from({ length: card.required }, (_, i) => i);
  const few = card.required <= 4;

  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border-2 border-accent/40 bg-surface p-4 sm:p-5 shadow-2xl transition-all select-none">
      <div className="min-h-0 space-y-3">
        {/* Cabecera del Reverso */}
        <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
          <div className="min-w-0">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-accent-text">
              Cartilla de sellos
            </span>
            <h3 className="font-display font-bold text-base text-fg truncate">{card.name}</h3>
            <p className="text-xs text-fg-3 truncate">{card.businessName}</p>
          </div>
          <button
            type="button"
            aria-label="Voltear al frente"
            onClick={(e) => {
              e.stopPropagation();
              onFlip();
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-fg-2 hover:bg-hover hover:text-fg transition"
          >
            <RotateIcon className="size-4" />
          </button>
        </div>

        <p className="text-[11px] text-fg-3 leading-tight">
          Recibes 1 sello por cada reserva jugada y confirmada en la sede.
        </p>

        {/* Grilla de Sellos */}
        <ul
          className={`grid max-h-52 content-start overflow-y-auto no-scrollbar gap-2 py-1 pr-0.5 ${
            few ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-4 sm:grid-cols-5'
          }`}
          aria-label={`${card.completed} de ${card.required} sellos acumulados`}
        >
          {slots.map((i) => {
            const stamp = card.stamps[i];
            const isGoal = i === card.required - 1;

            if (stamp) {
              return (
                <li
                  key={i}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-accent/40 bg-accent/15 p-1 text-center shadow-sm"
                >
                  <span className="text-[9px] font-black text-accent-text">#{i + 1}</span>
                  <div className="my-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-glow-accent">
                    <SoccerBallIcon className="size-3.5" />
                  </div>
                  <span className="text-[8px] font-medium leading-none text-fg-2 truncate max-w-full">
                    {stampDate.format(new Date(stamp.playedAt))}
                  </span>
                </li>
              );
            }

            return (
              <li
                key={i}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl p-1 text-center transition-all ${
                  isGoal
                    ? 'border-2 border-dashed border-accent bg-accent/10 animate-pulse'
                    : 'border-2 border-dashed border-hairline bg-surface-2/40'
                }`}
              >
                <span className={`text-[9px] font-bold ${isGoal ? 'text-accent-text' : 'text-fg-3'}`}>
                  #{i + 1}
                </span>
                {isGoal ? (
                  <>
                    <TrophyIcon className="size-4 text-accent-text" />
                    <span className="text-[8px] font-extrabold uppercase text-accent-text">¡Meta!</span>
                  </>
                ) : (
                  <span className="text-[10px] text-fg-3/60">⚽</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Botón inferior para regresar */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFlip();
        }}
        className="w-full shrink-0 rounded-xl bg-surface-2 border border-hairline py-2.5 text-xs font-bold text-fg hover:border-accent hover:bg-surface transition active:scale-95 shadow-sm"
      >
        ↺ Volver a la portada del cupón
      </button>
    </div>
  );
}

type IconProps = { className?: string };

const TicketIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-4V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Zm11-4v2m0 4v2m0 4v2" />
  </svg>
);

const BoltIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const SparklesIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="m12 3-1.9 4.3a2 2 0 0 1-.9.9L4.9 10l4.3 1.9a2 2 0 0 1 .9.9L12 17l1.9-4.3a2 2 0 0 1 .9-.9l4.3-1.9-4.3-1.9a2 2 0 0 1-.9-.9L12 3z" />
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
