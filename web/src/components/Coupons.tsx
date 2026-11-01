import { useSession } from '../lib/session';
import type { PlayerCoupon, PublicCoupon } from '../lib/types';
import { useApi } from '../lib/useApi';
import { LoyaltyCard } from './LoyaltyCard';
import { SparklesIcon } from './PitchChrome';

/** Cupones de la sede con diseño LoyaltyCard y soporte de Flip 3D interactivo. */
export function BusinessCoupons({
  slug,
  businessName,
  plain = false,
}: {
  slug: string;
  businessName?: string;
  plain?: boolean;
}) {
  const { token } = useSession();
  const coupons = useApi<PublicCoupon[]>(`/public/businesses/${slug}/coupons`);
  const mine = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);

  const offered = coupons.data ?? [];
  if (offered.length === 0) return null;

  return (
    <section className={plain ? 'border-t border-hairline pt-4 space-y-3' : 'space-y-3'} aria-label="Cupones y fidelización">
      <div className="flex flex-col gap-0.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-text">
          <SparklesIcon className="size-3" />
          Fidelización y Recompensas
        </div>
        <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-fg">
          Cupones y tarjetas de esta sede
        </h2>
        <p className="text-xs text-fg-3">
          Acumulas sellos por cada reserva jugada y pagada. Toca la tarjeta para ver los sellos.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {offered.map((coupon) => {
          const card = mine.data?.find((c) => c.couponId === coupon.id);
          const playerCard: PlayerCoupon = card ?? {
            couponId: coupon.id,
            businessName: businessName ?? 'Esta sede',
            businessSlug: slug,
            name: coupon.name,
            rewardDescription: coupon.rewardDescription,
            imageUrl: coupon.imageUrl,
            status: 'IN_PROGRESS',
            completed: 0,
            required: coupon.requiredReservations,
            remaining: coupon.requiredReservations,
            expiresAt: coupon.expiresAt,
            stamps: [],
          };

          return (
            <li key={coupon.id} className="min-w-0">
              <LoyaltyCard card={playerCard} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
