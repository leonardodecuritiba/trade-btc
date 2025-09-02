import { GetCurrentQuoteUseCase, IQuoteCache, IQuoteProvider } from '../../../../packages/application/src/use-cases/get-current-quote';
import { AppError } from '../../../../packages/shared/src/errors';

class MemCache implements IQuoteCache {
  private v: any = null;
  async get() { return this.v; }
  async set(value: any) { this.v = value; }
}

class OkProvider implements IQuoteProvider {
  async fetchCurrent() {
    return { buy: 100, sell: 99, source: 'MercadoBitcoin', ts: new Date().toISOString() };
  }
}
class FailProvider implements IQuoteProvider {
  async fetchCurrent(): Promise<{ buy: number; sell: number; source: string; ts: string }> {
    throw new Error('fail');
  }
}

describe('GetCurrentQuoteUseCase (unit)', () => {
  it('returns provider data and populates cache on miss', async () => {
    const cache = new MemCache();
    const uc = new GetCurrentQuoteUseCase(cache, new OkProvider());
    const dto = await uc.execute();
    expect(dto.buy).toBe(100);
    expect(dto.sell).toBe(99);
    expect(dto.source).toBe('MercadoBitcoin');
    const cached = await cache.get();
    expect(cached.buy).toBe(100);
  });

  it('returns cache on hit without calling provider', async () => {
    const cache = new MemCache();
    const ts = new Date().toISOString();
    await cache.set({ buy: 123, sell: 122, source: 'MercadoBitcoin', ts });
    const uc = new GetCurrentQuoteUseCase(cache, new FailProvider());
    const dto = await uc.execute();
    expect(dto.buy).toBe(123);
    expect(dto.ageMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to cache if provider fails and cache has value; otherwise throws 503', async () => {
    const cache = new MemCache();
    const uc1 = new GetCurrentQuoteUseCase(cache, new FailProvider());
    await expect(uc1.execute()).rejects.toBeInstanceOf(AppError);
    await cache.set({ buy: 200, sell: 199, source: 'MercadoBitcoin', ts: new Date().toISOString() });
    const uc2 = new GetCurrentQuoteUseCase(cache, new FailProvider());
    const dto = await uc2.execute();
    expect(dto.buy).toBe(200);
  });
});
