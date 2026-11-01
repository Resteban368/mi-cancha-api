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
      <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-surface to-surface-2 p-3.5 sm:p-4 shadow-lg shadow-primary/10 transition-all">
        {/* Glow de fondo decorativo */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-primary/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 size-36 rounded-full bg-accent-lime/15 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Ícono de regalo / trofeo destacado con animación */}
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent-lime text-slate-950 shadow-md shadow-primary/30">
              <TicketIcon className="size-5.5 font-bold" />
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-lime opacity-80" />
                <span className="relative inline-flex size-3 rounded-full bg-accent-lime" />
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                  <SparklesIcon className="size-3" />
                  ¡Cupón completado!
                </span>
                {earnedCount > 1 && (
                  <span className="rounded-full bg-accent-lime/20 px-1.5 py-0.2 text-[10px] font-bold text-accent-lime">
                    +{earnedCount - 1} más
                  </span>
                )}
              </div>

              <h2 className="text-sm font-bold text-fg leading-tight">
                {earnedCount === 1
                  ? '¡Tienes 1 premio listo para reclamar!'
                  : `¡Tienes ${earnedCount} premios listos para reclamar!`}
              </h2>

              <p className="text-xs text-fg-2 line-clamp-2">
                {earnedCount === 1 ? (
                  <>
                    <strong className="text-fg font-semibold">{topEarned.rewardDescription}</strong> en{' '}
                    <span className="text-primary font-medium">{topEarned.businessName}</span>
                  </>
                ) : (
                  <>
                    En{' '}
                    <span className="text-primary font-medium">
                      {earnedCoupons.map((c) => c.businessName).slice(0, 2).join(', ')}
                      {earnedCount > 2 ? ' y más' : ''}
                    </span>
                  </>
                )}
              </p>

              <div className="pt-1.5">
                <Link
                  to="/cupones"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-glow-primary transition hover:brightness-105 active:scale-95"
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
            className="shrink-0 -mr-1 -mt-1 p-1.5 text-fg-3 hover:text-fg rounded-lg hover:bg-surface-2 transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (topNear) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-accent-lime/30 bg-gradient-to-r from-surface to-surface-2 p-3.5 sm:p-4 shadow-sm transition-all">
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-lime/20 border border-accent-lime/40 text-accent-lime shadow-sm">
              <BoltIcon className="size-5" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-lime/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent-lime">
                  ¡A 1 partido de ganar!
                </span>
              </div>

              <h2 className="text-sm font-bold text-fg leading-tight">
                ¡Estás a solo 1 reserva de un premio!
              </h2>

              <p className="text-xs text-fg-2 line-clamp-2">
                En <span className="text-fg font-semibold">{topNear.businessName}</span>:{' '}
                {topNear.rewardDescription}
              </p>

              <div className="pt-1.5">
                <Link
                  to="/cupones"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-fg-2 hover:text-fg hover:border-accent-lime transition active:scale-95"
                >
                  <span>Ver mi cartilla de sellos</span>
                  <ArrowForwardIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissAlert}
            aria-label="Cerrar aviso"
            className="shrink-0 -mr-1 -mt-1 p-1.5 text-fg-3 hover:text-fg rounded-lg hover:bg-surface-2 transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
