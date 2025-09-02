import { GetPositionsUseCase, IPositionRepo } from '../../../../packages/application/src/use-cases/get-positions';

class FakeRepo implements IPositionRepo {
  constructor(private list: any[]) {}
  async findOpenByUser(_userId: string) { return this.list; }
}

describe('GetPositionsUseCase (unit)', () => {
  it('maps calculations with a single buy snapshot and sorts by openedAt', async () => {
    const positions = [
      { id: 'p2', openedAt: new Date('2024-01-02T00:00:00Z'), qtyBTC: 0.002, unitPriceBRL: 110000 },
      { id: 'p1', openedAt: new Date('2024-01-01T00:00:00Z'), qtyBTC: 0.001, unitPriceBRL: 100000 },
    ];
    const repo = new FakeRepo(positions);
    const quotes = { getBuy: async () => ({ priceBRL: 120000, ts: new Date('2024-02-01T00:00:00Z').toISOString() }) };
    const uc = new GetPositionsUseCase(repo as any, quotes as any);
    const res = await uc.execute('u1');
    expect(res.length).toBe(2);
    // Sorted by openedAt
    expect(res[0].positionId).toBe('p1');
    // investedBRL = qty*unitPrice; currentGrossBRL = qty*current; changePct = (cur - unit)/unit
    expect(res[0].investedBRL).toBe(100); // 0.001*100000
    expect(res[0].currentGrossBRL).toBe(120); // 0.001*120000
    expect(res[0].changePct).toBe(0.2); // 20%
    // Same currentPrice for both
    expect(res[1].currentPriceBRL).toBe(120000);
  });
});

