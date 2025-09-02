import { GetStatementUseCase, ITransactionRepo, StatementType } from '../../../../packages/application/src/use-cases/get-statement';

class FakeTxRepo implements ITransactionRepo {
  constructor(private rows: any[]) {}
  async findForStatement(input: any) {
    const out = this.rows.filter((r) => (!input.types || input.types.includes(r.type)));
    return { rows: out, hasMore: false, nextCursor: undefined } as any;
  }
}

describe('GetStatementUseCase (unit)', () => {
  it('maps types/signs and enforces max range', async () => {
    const now = new Date();
    const rows = [
      { id: 'd1', type: 'DEPOSIT', createdAt: now, amountBRL: 100, qtyBTC: null, quotePriceBRL: null },
      { id: 'b1', type: 'BUY', createdAt: now, amountBRL: 100, qtyBTC: 0.001, quotePriceBRL: 100000 },
      { id: 's1', type: 'SELL', createdAt: now, amountBRL: 150, qtyBTC: 0.0015, quotePriceBRL: 100000 },
      { id: 'r1', type: 'REBOOK', createdAt: now, amountBRL: null, qtyBTC: 0.0005, quotePriceBRL: 110000 },
    ];
    const repo = new FakeTxRepo(rows);
    const uc = new GetStatementUseCase(repo as any);
    const res = await uc.execute('u1', { from: new Date(now.getTime() - 86_400_000), to: now, types: ['DEPOSIT','BUY','SELL','REBOOK'] as StatementType[] });
    expect(res.items).toHaveLength(4);
    const dep = res.items.find(i => i.id === 'd1')!;
    expect(dep.amountBRL).toBe(100);
    expect(dep.quoteSide).toBeNull();
    const buy = res.items.find(i => i.id === 'b1')!;
    expect(buy.amountBRL).toBe(-100);
    expect(buy.qtyBTC).toBe(0.001);
    expect(buy.quoteSide).toBe('sell');
    const sell = res.items.find(i => i.id === 's1')!;
    expect(sell.amountBRL).toBe(150);
    expect(sell.qtyBTC).toBe(-0.0015);
    expect(sell.quoteSide).toBe('buy');
    const rb = res.items.find(i => i.id === 'r1')!;
    expect(rb.amountBRL).toBeNull();
    expect(rb.unitPriceBRL).toBe(110000);
  });

  it('rejects range over 90 days', async () => {
    const repo = new FakeTxRepo([]);
    const uc = new GetStatementUseCase(repo as any);
    const now = new Date();
    const from = new Date(now.getTime() - (91 * 24 * 60 * 60 * 1000));
    await expect(uc.execute('u1', { from, to: now })).rejects.toBeTruthy();
  });

  it('normalizes from/to to Sao_Paulo day boundaries', async () => {
    const spy: any = { last: null };
    const repo: ITransactionRepo = {
      async findForStatement(input: any) { spy.last = input; return { rows: [], hasMore: false } as any; }
    } as any;
    const uc = new GetStatementUseCase(repo);
    const from = new Date('2024-01-01T12:00:00Z');
    const to = new Date('2024-01-01T12:00:00Z');
    await uc.execute('u1', { from, to });
    // In Jan 2024 (UTC-3, no DST): start 00:00 BRT -> 03:00Z; end 23:59:59.999 BRT -> 02:59:59.999Z next day
    expect(spy.last.from.toISOString()).toBe('2024-01-01T03:00:00.000Z');
    expect(spy.last.to.toISOString()).toBe('2024-01-02T02:59:59.999Z');
  });
});
