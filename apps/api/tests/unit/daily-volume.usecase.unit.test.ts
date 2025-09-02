import { GetDailyVolumeUseCase, IDailyVolumeRepo } from '../../../../packages/application/src/use-cases/get-daily-volume';

class FakeRepo implements IDailyVolumeRepo {
  constructor(private totals: { buy: number; sell: number }) {}
  async sumQtyBTC(where: { type: 'BUY' | 'SELL'; from: Date; to: Date }): Promise<number> {
    return where.type === 'BUY' ? this.totals.buy : this.totals.sell;
  }
}

describe('GetDailyVolumeUseCase (unit)', () => {
  it('computes date in Sao_Paulo TZ and truncates to 8 decimals', async () => {
    const repo = new FakeRepo({ buy: 0.00123456789, sell: 0.00234567891 });
    const uc = new GetDailyVolumeUseCase(repo);
    const now = new Date('2024-01-01T12:00:00Z');
    const dto = await uc.execute(now);
    expect(dto.timezone).toBe('America/Sao_Paulo');
    expect(dto.date).toBe('2024-01-01');
    expect(dto.boughtBTC).toBe(0.00123456);
    expect(dto.soldBTC).toBe(0.00234567);
  });
});

