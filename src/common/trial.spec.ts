import {
  isSubscriptionUsable,
  isTrialExpired,
  trialStatusOf,
} from './trial.js';

const now = new Date('2026-10-25T12:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe('prueba gratuita', () => {
  it('un plan de pago no tiene prueba ni vence', () => {
    const sub = { isActive: true, trialEndsAt: null };
    expect(isTrialExpired(sub, now)).toBe(false);
    expect(isSubscriptionUsable(sub, now)).toBe(true);
    expect(trialStatusOf(sub, now)).toEqual({
      trialEndsAt: null,
      trialDaysLeft: null,
      trialExpired: false,
    });
  });

  it('con la prueba vigente se puede operar y cuenta los días que faltan', () => {
    const sub = { isActive: true, trialEndsAt: inDays(14.2) };
    expect(isSubscriptionUsable(sub, now)).toBe(true);
    expect(trialStatusOf(sub, now)).toMatchObject({
      trialDaysLeft: 15,
      trialExpired: false,
    });
  });

  it('vencida la fecha deja de ser utilizable y los días quedan en 0', () => {
    const sub = { isActive: true, trialEndsAt: inDays(-1) };
    expect(isTrialExpired(sub, now)).toBe(true);
    expect(isSubscriptionUsable(sub, now)).toBe(false);
    expect(trialStatusOf(sub, now)).toMatchObject({
      trialDaysLeft: 0,
      trialExpired: true,
    });
  });

  it('un plan suspendido no es utilizable aunque la prueba no haya vencido', () => {
    expect(
      isSubscriptionUsable({ isActive: false, trialEndsAt: inDays(3) }, now),
    ).toBe(false);
    expect(isSubscriptionUsable(null, now)).toBe(false);
  });
});
