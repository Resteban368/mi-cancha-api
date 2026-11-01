import {
  courtPriceTable,
  monthlyBill,
  priceForCourts,
  subscriptionTerms,
} from './plan-pricing.js';

const COURT_PRICES = [79_000, 98_000, 117_000];

describe('plan-pricing', () => {
  it('toma el precio de la tabla según las canchas', () => {
    expect(priceForCourts(COURT_PRICES, 1)).toBe(79_000);
    expect(priceForCourts(COURT_PRICES, 3)).toBe(117_000);
    expect(courtPriceTable(COURT_PRICES)[1]).toEqual({
      courts: 2,
      monthlyPrice: 98_000,
    });
  });

  it('rechaza cantidades fuera de la tabla', () => {
    expect(() => priceForCourts(COURT_PRICES, 0)).toThrow(RangeError);
    expect(() => priceForCourts(COURT_PRICES, 4)).toThrow(RangeError);
  });

  it('suma el módulo solo si está activo y el plan es de pago', () => {
    expect(monthlyBill(117_000, true, 50_000)).toEqual({
      salesModulePrice: 50_000,
      totalMonthlyPrice: 167_000,
    });
    expect(monthlyBill(117_000, false, 50_000).totalMonthlyPrice).toBe(117_000);
    expect(monthlyBill(0, true, 50_000)).toEqual({
      salesModulePrice: 0,
      totalMonthlyPrice: 0,
    });
  });

  it('usa las canchas contratadas solo en el plan por canchas', () => {
    const priced = {
      monthlyPrice: 79_000,
      courtLimit: 20,
      pricedByCourts: true,
      courtPrices: COURT_PRICES,
    };
    expect(subscriptionTerms({ courts: 3, plan: priced })).toEqual({
      monthlyPrice: 117_000,
      courtLimit: 3,
    });
    const trial = {
      monthlyPrice: 0,
      courtLimit: 2,
      pricedByCourts: false,
      courtPrices: [],
    };
    expect(subscriptionTerms({ courts: null, plan: trial })).toEqual({
      monthlyPrice: 0,
      courtLimit: 2,
    });
  });
});
