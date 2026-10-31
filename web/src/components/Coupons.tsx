import { useState } from 'react';
import { Link } from 'react-router';
import { Card } from './ui';
import { useSession } from '../lib/session';
import type { PlayerCoupon, PublicCoupon } from '../lib/types';
import { useApi } from '../lib/useApi';

const date = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

const validUntil = (iso: string | null) =>
  iso ? `Válido hasta el ${date.format(new Date(iso))}` : 'Sin vencimiento';

/** "Faltan 3 reservas" o "Tu bono está listo". */
export function couponProgressLabel(
  card: Pick<PlayerCoupon, 'status' | 'remaining'>,
): string {
  if (card.status === 'EARNED') return 'Tu bono está listo';
  return card.remaining === 1
    ? 'Falta 1 reserva'
    : `Faltan ${card.remaining} reservas`;
}

export function CouponProgress({ card }: { card: PlayerCoupon }) {
  const earned = card.status === 'EARNED';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span
          className={`font-bold ${earned ? 'text-accent-text' : 'text-fg'}`}
        >
          {couponProgressLabel(card)}
        </span>
        <span className="tabular-nums text-fg-3">
          {card.completed} de {card.required}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Reservas de ${card.name}`}
        aria-valuemin={0}
        aria-valuemax={card.required}
        aria-valuenow={card.completed}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{
            width: `${Math.min(100, (card.completed / card.required) * 100)}%`,
          }}
        />
      </div>
      {earned && (
        <p className="mt-1.5 text-xs text-fg-2">
          Pídelo en la sede cuando vayas a pagar tu reserva.
        </p>
      )}
    </div>
  );
}

/** Imagen opcional del cupón; si no se puede cargar, la tarjeta sigue sin ella. */
function CouponImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[2/1] w-full bg-surface-2 object-cover"
    />
  );
}

/** Cupones de la sede, con mi avance si ya empecé alguno. No se muestra si no hay. */
export function BusinessCoupons({
  slug,
  plain = false,
}: {
  slug: string;
  plain?: boolean;
}) {
  const { token } = useSession();
  const coupons = useApi<PublicCoupon[]>(`/public/businesses/${slug}/coupons`);
  const mine = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);

  const offered = coupons.data ?? [];
  if (offered.length === 0) return null;

  const content = (
    <>
      <h2
        className={
          plain ? 'text-sm font-bold' : 'text-lg font-bold tracking-tight'
        }
      >
        Cupones de esta sede
      </h2>
      <p className="mt-0.5 text-xs text-fg-3">
        Cuentan las reservas que juegas y pagas por completo.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {offered.map((coupon) => {
          const card = mine.data?.find((c) => c.couponId === coupon.id);
          return (
            <li
              key={coupon.id}
              className="overflow-hidden rounded-xl border border-border"
            >
              <CouponImage url={coupon.imageUrl} />
              <div className="p-3.5">
                <h3 className="text-sm font-bold">{coupon.name}</h3>
                <p className="mt-0.5 text-sm text-fg-2">
                  Cada {coupon.requiredReservations}{' '}
                  {coupon.requiredReservations === 1 ? 'reserva' : 'reservas'}:{' '}
                  {coupon.rewardDescription}
                </p>
                <p className="mt-1 text-xs text-fg-3">
                  {validUntil(coupon.expiresAt)}
                </p>
                {card && (
                  <div className="mt-3">
                    <CouponProgress card={card} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
  return plain ? (
    <div className="border-t border-border pt-3">{content}</div>
  ) : (
    <Card className="shadow-sm">{content}</Card>
  );
}

/** Una tarjeta de "Mis cupones". */
export function MyCouponCard({ card }: { card: PlayerCoupon }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <CouponImage url={card.imageUrl} />
      <div className="p-4">
        {card.businessSlug ? (
          <Link
            to={`/${card.businessSlug}`}
            className="text-xs font-semibold text-accent-text hover:underline"
          >
            {card.businessName}
          </Link>
        ) : (
          <p className="text-xs font-semibold text-fg-3">{card.businessName}</p>
        )}
        <h2 className="mt-0.5 text-base font-bold tracking-tight">
          {card.name}
        </h2>
        <p className="mt-0.5 text-sm text-fg-2">{card.rewardDescription}</p>
        <p className="mt-1 text-xs text-fg-3">{validUntil(card.expiresAt)}</p>
        <div className="mt-3">
          <CouponProgress card={card} />
        </div>
      </div>
    </article>
  );
}
