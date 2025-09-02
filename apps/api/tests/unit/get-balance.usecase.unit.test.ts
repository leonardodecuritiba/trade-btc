import { GetBalanceUseCase, IAccountReader } from '../../../../packages/application/src/use-cases/get-balance';

class FakeAccountRepo implements IAccountReader {
  constructor(private data: { fiatBalanceBRL: number; updatedAt: Date } | null) {}
  async getByUserId(_userId: string) {
    return this.data;
  }
}

describe('GetBalanceUseCase (unit)', () => {
  it('returns mapped balance and updatedAt when account exists', async () => {
    const now = new Date();
    const repo = new FakeAccountRepo({ fiatBalanceBRL: 123.45, updatedAt: now });
    const uc = new GetBalanceUseCase(repo);
    const res = await uc.execute('user-1');
    expect(res.balanceBRL).toBe(123.45);
    expect(res.currency).toBe('BRL');
    expect(res.updatedAt).toBe(now);
  });

  it('returns zero balance and epoch updatedAt when account is missing', async () => {
    const repo = new FakeAccountRepo(null);
    const uc = new GetBalanceUseCase(repo);
    const res = await uc.execute('user-2');
    expect(res.balanceBRL).toBe(0);
    expect(res.currency).toBe('BRL');
    expect(res.updatedAt.getTime()).toBe(0);
  });
});

