import { BuyBTCUseCase, IBuyRepository, IOrderStore, IQuoteService, IPurchaseEmailService, IUserReader2 } from '../../../../packages/application/src/use-cases/buy-btc';
import { AppError } from '../../../../packages/shared/src/errors';

class FakeRepo implements IBuyRepository {
  public executed: any = null;
  constructor(private sufficient = true) {}
  async hasSufficientBalance(_u: string, a: number) { return this.sufficient; }
  async executeBuyTx(input: any) { this.executed = input; return { transactionId: 't1', positionId: 'p1' }; }
}
class FakeOrders implements IOrderStore {
  public store = new Map<string, { orderId: string; amountBRL: number }>();
  async createOrGet(userId: string, crid: string, amountBRL: number) {
    const k = `${userId}:${crid}`;
    if (!this.store.has(k)) this.store.set(k, { orderId: 'o1', amountBRL });
    return { orderId: this.store.get(k)!.orderId, created: true };
  }
  async markProcessed(_orderId: string) { /* noop */ }
  async getByClientRequest(userId: string, crid: string) { return this.store.get(`${userId}:${crid}`) || null; }
}
class FakeQuotes implements IQuoteService {
  constructor(private price: number) {}
  async getSell() { return { priceBRL: this.price, ts: new Date().toISOString() }; }
}
class FakeUsers implements IUserReader2 { async findById(id: string) { return { id, name: 'U', email: 'u@e.com' }; } }
class FakeEmail implements IPurchaseEmailService { async sendPurchaseConfirmation() { /* ok */ } }

describe('BuyBTCUseCase (unit)', () => {
  it('accept checks funds and creates order', async () => {
    const uc = new BuyBTCUseCase(new FakeQuotes(100000), new FakeRepo(true), new FakeOrders(), new FakeUsers(), new FakeEmail());
    const r = await uc.accept('u1', 100, 'cr1');
    expect(r.status).toBe('ENQUEUED');
  });

  it('accept fails with insufficient funds', async () => {
    const uc = new BuyBTCUseCase(new FakeQuotes(100000), new FakeRepo(false), new FakeOrders(), new FakeUsers(), new FakeEmail());
    await expect(uc.accept('u1', 100, 'cr1')).rejects.toBeInstanceOf(AppError);
  });

  it('process computes qty with truncate8 and executes buy tx', async () => {
    const repo = new FakeRepo(true);
    const orders = new FakeOrders();
    const uc = new BuyBTCUseCase(new FakeQuotes(100000), repo, orders, new FakeUsers(), new FakeEmail());
    await uc.accept('u1', 100, 'cr1');
    await uc.process('u1', 'cr1');
    expect(repo.executed.qtyBTC).toBe(0.001);
  });
});

