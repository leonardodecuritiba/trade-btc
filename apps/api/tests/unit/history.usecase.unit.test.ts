import { GetHistory24hUseCase, IQuoteHistoryRepo } from '../../../../packages/application/src/use-cases/get-history-24h';

class FakeHistoryRepo implements IQuoteHistoryRepo {
  constructor(private snaps: any[]) {}
  async findSnapshots(from: Date, to: Date) {
    return this.snaps.filter(s => s.ts >= from && s.ts <= to);
  }
}

function mkTs(s: string) { return new Date(s); }

describe('GetHistory24hUseCase (unit)', () => {
  it('returns 144 slots with null gaps and merges snapshots', async () => {
    const now = new Date('2024-01-01T12:34:56Z');
    // Provide two snapshots within range at 12:30 and 12:00 UTC
    const snaps = [
      { ts: mkTs('2024-01-01T12:30:00Z'), buy: 101000, sell: 100000, source: 'Stub' },
      { ts: mkTs('2024-01-01T12:00:00Z'), buy: 102000, sell: 100500, source: 'Stub' },
    ];
    const repo = new FakeHistoryRepo(snaps);
    const uc = new GetHistory24hUseCase(repo);
    const res = await uc.execute(now);
    expect(res.slots).toBe(144);
    expect(res.items.length).toBe(144);
    // Contains those exact timestamps
    const has1230 = res.items.find(i => i.ts === '2024-01-01T12:30:00.000Z');
    expect(has1230?.buy).toBe(101000);
    const has1200 = res.items.find(i => i.ts === '2024-01-01T12:00:00.000Z');
    expect(has1200?.sell).toBe(100500);
    // A gap
    const gap = res.items.find(i => i.ts === '2024-01-01T12:10:00.000Z');
    expect(gap?.buy).toBeNull();
  });
});
