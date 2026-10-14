import { dayRange } from './day-range.js';

describe('dayRange', () => {
  it('convierte un día de Colombia (UTC-5) a su rango en UTC', () => {
    expect(dayRange('2026-10-13', '-05:00')).toEqual({
      from: new Date('2026-10-13T05:00:00.000Z'),
      to: new Date('2026-10-14T05:00:00.000Z'),
    });
  });
});
