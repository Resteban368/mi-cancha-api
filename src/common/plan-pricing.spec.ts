import { readFileSync } from 'node:fs';
import {
  courtPriceTable,
  priceForCourts,
  subscriptionTerms,
} from './plan-pricing.js';

describe('plan-pricing', () => {
  it('sigue los incrementos por tramo de la tabla de precios', () => {
    expect(priceForCourts(1)).toBe(79_000);
    expect(priceForCourts(5)).toBe(155_000);
    expect(priceForCourts(10)).toBe(235_000);
    expect(priceForCourts(15)).toBe(300_000);
    expect(priceForCourts(20)).toBe(345_000);
    const increments = courtPriceTable()
      .slice(1)
      .map((row, i) => row.monthlyPrice - priceForCourts(i + 1));
    expect(increments).toEqual([
      ...Array<number>(4).fill(19_000),
      ...Array<number>(5).fill(16_000),
      ...Array<number>(5).fill(13_000),
      ...Array<number>(5).fill(9_000),
    ]);
  });

  it('rechaza cantidades fuera de la tabla', () => {
    expect(() => priceForCourts(0)).toThrow(RangeError);
    expect(() => priceForCourts(21)).toThrow(RangeError);
  });

  it('usa las canchas contratadas solo en el plan por canchas', () => {
    const priced = {
      monthlyPrice: 79_000,
      courtLimit: 20,
      pricedByCourts: true,
    };
    expect(subscriptionTerms({ courts: 3, plan: priced })).toEqual({
      monthlyPrice: 117_000,
      courtLimit: 3,
    });
    const trial = { monthlyPrice: 0, courtLimit: 2, pricedByCourts: false };
    expect(subscriptionTerms({ courts: null, plan: trial })).toEqual({
      monthlyPrice: 0,
      courtLimit: 2,
    });
  });

  it('la landing publica los mismos precios', () => {
    const source = readFileSync(
      new URL('../../landing/src/precios.ts', import.meta.url),
      'utf8',
    );
    const list = /PRECIOS = \[([^\]]+)\]/.exec(source)?.[1] ?? '';
    const prices = [...list.matchAll(/\d[\d_]*/g)].map((m) =>
      Number(m[0].replaceAll('_', '')),
    );
    expect(prices).toEqual(courtPriceTable().map((r) => r.monthlyPrice));
  });
});
