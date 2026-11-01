import { Link } from 'react-router';
import { usePlayerCoupons } from '../lib/couponsContext';
import { ArrowForwardIcon, BoltIcon, CloseIcon, SparklesIcon, TicketIcon } from './PitchChrome';

export function CouponAlertBanner() {
  const { earnedCoupons, nearCoupons, earnedCount, nearCount, dismissed, dismissAlert } = usePlayerCoupons();

  if (dismissed) return null;
  if (earnedCount === 0 && nearCount === 0) return null;

  const isEarned = earnedCount > 0;
  const topEarned = earnedCoupons[0];
  const topNear = nearCoupons[0];

  if (isEarned && topEarned) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 via-surface to-surface-2 p-3.5 sm:p-4 shadow-lg shadow-accent/5 transition-all">
        {/* Glow ambiental de fondo */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-32 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Ícono destacado de premio */}
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-glow-accent">
              <TicketIcon className="size-5 font-bold" />
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-accent ring-2 ring-surface" />
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent-text">
                  <SparklesIcon className="size-3" />
                  ¡Cupón completado!
                </span>
                {earnedCount > 1 && (
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent-text">
                    +{earnedCount - 1} más
                  </span>
                )}
              </div>

              <h2 className="font-display text-sm sm:text-base font-bold text-fg leading-snug">
                {earnedCount === 1
                  ? '¡Tienes 1 premio listo para reclamar!'
                  : `¡Tienes ${earnedCount} premios listos para reclamar!`}
              </h2>

              <p className="text-xs text-fg-2 line-clamp-2">
                {earnedCount === 1 ? (
                  <>
                    <span className="font-bold text-fg">{topEarned.rewardDescription}</span> en{' '}
                    <span className="font-semibold text-accent-text">{topEarned.businessName}</span>
                  </>
                ) : (
                  <>
                    En{' '}
                    <span className="font-semibold text-accent-text">
                      {earnedCoupons.map((c) => c.businessName).slice(0, 2).join(', ')}
                      {earnedCount > 2 ? ' y más' : ''}
                    </span>
                  </>
                )}
              </p>

              <div className="pt-1.5">
                <Link
                  to="/cupones"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg shadow-glow-accent transition hover:brightness-105 active:scale-95"
                >
                  <span>Reclamar premio</span>
                  <ArrowForwardIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissAlert}
            aria-label="Cerrar aviso de cupón"
            className="shrink-0 -mr-1 -mt-1 flex size-8 items-center justify-center rounded-xl text-fg-3 transition hover:bg-hover hover:text-fg"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (topNear) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-surface to-surface-2 p-3.5 sm:p-4 shadow-sm transition-all">
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-text shadow-sm">
              <BoltIcon className="size-5" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-text">
                  <BoltIcon className="size-3" />
                  ¡A solo 1 reserva!
                </span>
              </div>

              <h2 className="font-display text-sm sm:text-base font-bold text-fg leading-snug">
                ¡Estás a 1 partido de ganar un premio!
              </h2>

              <p className="text-xs text-fg-2 line-clamp-2">
                En <span className="font-semibold text-fg">{topNear.businessName}</span>:{' '}
                {topNear.rewardDescription}
              </p>

              <div className="pt-1.5">
                <Link
                  to="/cupones"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3.5 py-1.5 text-xs font-bold text-fg-2 transition hover:border-accent hover:text-fg active:scale-95 shadow-sm"
                >
                  <span>Ver cartilla de sellos</span>
                  <ArrowForwardIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissAlert}
            aria-label="Cerrar aviso"
            className="shrink-0 -mr-1 -mt-1 flex size-8 items-center justify-center rounded-xl text-fg-3 transition hover:bg-hover hover:text-fg"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
