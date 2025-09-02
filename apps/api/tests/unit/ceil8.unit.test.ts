import { ceil8 } from '../../../../packages/shared/src/number';


describe('ceil8', () => {
  it('ceils to 8 decimals', () => {
    expect(ceil8(0.000000001)).toBe(0.00000001);
    expect(ceil8(0.123456781)).toBe(0.12345679);
    expect(ceil8(1)).toBe(1);
  });
});
