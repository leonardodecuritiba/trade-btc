import { AppError } from '../../../shared/src/errors';
import { truncate8 } from '../../../shared/src/number';

export interface BuyRequest {
  userId: string;
  amountBRL: number;
  clientRequestId: string;
}

export interface IQuoteService {
  getSell(): Promise<{ priceBRL: number; ts: string }>;
}

export interface IBuyRepository {
  hasSufficientBalance(userId: string, amountBRL: number): Promise<boolean>;
  executeBuyTx(input: {
    userId: string;
    amountBRL: number;
    qtyBTC: number;
    quotePriceBRL: number;
    clientRequestId: string;
  }): Promise<{ transactionId: string; positionId: string }>;
}

export interface IOrderStore {
  createOrGet(userId: string, clientRequestId: string, amountBRL: number): Promise<{ orderId: string; created: boolean }>;
  markProcessed(orderId: string): Promise<void>;
  getByClientRequest(userId: string, clientRequestId: string): Promise<{ orderId: string; amountBRL: number } | null>;
}

export interface IPurchaseEmailService {
  sendPurchaseConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; qtyBTC: number; unitPriceBRL: number }): Promise<void>;
}

export interface IUserReader2 {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>;
}

export class BuyBTCUseCase {
  constructor(
    private quotes: IQuoteService,
    private repo: IBuyRepository,
    private orders: IOrderStore,
    private users: IUserReader2,
    private email: IPurchaseEmailService,
  ) {}

  async accept(userId: string, amountBRL: number, clientRequestId: string): Promise<{ orderId: string; status: 'ENQUEUED' | 'PROCESSED'; created: boolean }>{
    if (!clientRequestId || clientRequestId.trim().length === 0) {
      throw new AppError(422, 'INVALID_INPUT', 'clientRequestId is required');
    }
    // Idempotency: if an order already exists, return it regardless of current balance
    const existing = await this.orders.getByClientRequest(userId, clientRequestId);
    if (existing) {
      return { orderId: existing.orderId, status: 'ENQUEUED', created: false };
    }
    // For new orders, ensure sufficient funds at accept time
    if (!(await this.repo.hasSufficientBalance(userId, amountBRL))) {
      throw new AppError(422, 'INSUFFICIENT_FUNDS', 'Insufficient BRL balance');
    }
    const { orderId, created } = await this.orders.createOrGet(userId, clientRequestId, amountBRL);
    return { orderId, status: 'ENQUEUED', created };
  }

  async process(userId: string, clientRequestId: string): Promise<void> {
    // load quote sell
    const q = await this.quotes.getSell();
    const price = q.priceBRL;
    if (!isFinite(price) || price <= 0) {
      throw new AppError(503, 'QUOTE_UNAVAILABLE', 'Quote unavailable');
    }
    const order = await this.orders.getByClientRequest(userId, clientRequestId);
    if (!order) return; // nothing to do
    const amount = order.amountBRL;
    const qtyBTC = truncate8(amount / price);
    await this.repo.executeBuyTx({ userId, amountBRL: amount, qtyBTC, quotePriceBRL: price, clientRequestId });
    await this.orders.markProcessed(order.orderId);
    // fire-and-forget email
    (async () => {
      try {
        const u = await this.users.findById(userId);
        if (u) await this.email.sendPurchaseConfirmation({ email: u.email, name: u.name }, { amountBRL: amount, qtyBTC, unitPriceBRL: price });
      } catch { /* ignore */ }
    })();
    return;
  }
}
