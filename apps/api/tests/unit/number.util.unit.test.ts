import { truncate8 } from '../../../../packages/shared/src/number';

describe('truncate8', () => {
  it('truncates to 8 decimal places', () => {
    expect(truncate8(0.00123456789)).toBe(0.00123456);
    expect(truncate8(1.999999999)).toBe(1.99999999);
    expect(truncate8(0)).toBe(0);
  });
});

