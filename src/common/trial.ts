import type { Prisma } from '../generated/prisma/client.js';

/** Nombre del plan que se asigna a los negocios que se registran por su cuenta. */
export const TRIAL_PLAN_NAME = 'Prueba';
export const TRIAL_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

interface SubscriptionState {
  isActive: boolean;
  trialEndsAt: Date | null;
}

/** La prueba gratuita ya venció. */
export function isTrialExpired(
  subscription: SubscriptionState | null | undefined,
  now = new Date(),
): boolean {
  return !!subscription?.trialEndsAt && subscription.trialEndsAt <= now;
}

/** El negocio puede operar: plan activo y, si es de prueba, sin vencer. */
export function isSubscriptionUsable(
  subscription: SubscriptionState | null | undefined,
  now = new Date(),
): boolean {
  return !!subscription?.isActive && !isTrialExpired(subscription, now);
}

/** Lo mismo que isSubscriptionUsable, para usarlo dentro de un where de Prisma. */
export function usableSubscriptionWhere(
  now = new Date(),
): Prisma.SubscriptionWhereInput {
  return {
    isActive: true,
    OR: [{ trialEndsAt: null }, { trialEndsAt: { gt: now } }],
  };
}

export interface TrialStatus {
  trialEndsAt: Date | null;
  /** Días que le quedan (0 si vence hoy o ya venció); null si no es una prueba. */
  trialDaysLeft: number | null;
  trialExpired: boolean;
}

export function trialStatusOf(
  subscription: { trialEndsAt: Date | null } | null | undefined,
  now = new Date(),
): TrialStatus {
  const endsAt = subscription?.trialEndsAt ?? null;
  if (!endsAt) {
    return { trialEndsAt: null, trialDaysLeft: null, trialExpired: false };
  }
  return {
    trialEndsAt: endsAt,
    trialDaysLeft: Math.max(
      0,
      Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS),
    ),
    trialExpired: endsAt <= now,
  };
}

/** Crea la suscripción de prueba de un negocio nuevo (15 días con el plan «Prueba»). */
export async function createTrialSubscription(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  const plan = await tx.plan.findUnique({ where: { name: TRIAL_PLAN_NAME } });
  if (!plan) return;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * DAY_MS);
  await tx.subscription.create({
    data: {
      businessId,
      planId: plan.id,
      nextPayment: trialEndsAt,
      trialEndsAt,
      autoBilling: false,
    },
  });
}
