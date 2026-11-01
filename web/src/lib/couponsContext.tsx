import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import { useSession } from './session';
import { useApi } from './useApi';
import type { PlayerCoupon } from './types';

const DISMISS_KEY = 'mi-cancha-coupon-alert-dismissed';

export interface PlayerCouponsContextValue {
  coupons: PlayerCoupon[];
  loading: boolean;
  error?: string;
  earnedCoupons: PlayerCoupon[];
  nearCoupons: PlayerCoupon[];
  earnedCount: number;
  nearCount: number;
  dismissed: boolean;
  dismissAlert: () => void;
  reload: () => void;
}

const Context = createContext<PlayerCouponsContextValue | null>(null);

export function PlayerCouponsProvider({ children }: { children: ReactNode }) {
  const { token, player } = useSession();
  const apiResult = useApi<PlayerCoupon[]>(token ? '/player/coupons' : null, token);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dismissAlert = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Sin sessionStorage no se persiste entre pestañas.
    }
    setDismissed(true);
  }, []);

  const coupons = apiResult.data ?? [];

  const earnedCoupons = useMemo(() => {
    if (!token || !player) return [];
    return coupons.filter(
      (c) => c.status === 'EARNED' || (c.required > 0 && c.completed >= c.required),
    );
  }, [coupons, token, player]);

  const nearCoupons = useMemo(() => {
    if (!token || !player) return [];
    return coupons.filter((c) => c.status === 'IN_PROGRESS' && c.remaining === 1);
  }, [coupons, token, player]);

  const value = useMemo(
    () => ({
      coupons,
      loading: apiResult.loading,
      error: apiResult.error,
      earnedCoupons,
      nearCoupons,
      earnedCount: earnedCoupons.length,
      nearCount: nearCoupons.length,
      dismissed,
      dismissAlert,
      reload: apiResult.reload,
    }),
    [
      coupons,
      apiResult.loading,
      apiResult.error,
      earnedCoupons,
      nearCoupons,
      dismissed,
      dismissAlert,
      apiResult.reload,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlayerCoupons(): PlayerCouponsContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('usePlayerCoupons debe usarse dentro de PlayerCouponsProvider');
  }
  return ctx;
}
