import { bankersRound2 } from '../../../../packages/shared/src/money';

describe('bankersRound2', () => {
  it('rounds halves to even at 2 decimals', () => {
    expect(bankersRound2(1.005)).toBe(1.00); // 100.5 -> 100 (even)
    expect(bankersRound2(1.015)).toBe(1.02); // 101.5 -> 102 (odd -> even)
    expect(bankersRound2(2.125)).toBe(2.12); // 212.5 -> 212 (even)
    expect(bankersRound2(2.135)).toBe(2.14); // 213.5 -> 214 (odd -> even)
  });

  it('handles small and whole numbers', () => {
    expect(bankersRound2(0.004)).toBe(0.00);
    expect(bankersRound2(0.006)).toBe(0.01);
    expect(bankersRound2(100)).toBe(100.00);
  });
});

