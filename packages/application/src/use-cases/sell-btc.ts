import { AppError } from '../../../shared/src/errors';
import { ceil8, truncate8 } from '../../../shared/src/number';
import { bankersRound2 } from '../../../shared/src/money';

export interface SellAcceptRequest {
  userId: string;
  amountBRL: number;
  clientRequestId: string;
}

export interface ISellQuoteService {
  getBuy(): Promise<{ priceBRL: number; ts: string }>;
}

export interface ISellRepository {
  hasSufficientHoldings(userId: string, qtyBTCNeeded: number): Promise<boolean>;
  executeSellTx(input: {
    userId: string;
    amountBRL: number;
    qtyBTCNeeded: number;
    quotePriceBRL: number;
    clientRequestId: string;
  }): Promise<{ transactionId: string; qtySold: number; creditedBRL: number }>;
}

export interface IOrderStoreSell {
  createOrGet(userId: string, clientRequestId: string, amountBRL: number): Promise<{ orderId: string; created: boolean }>;
  markProcessed(orderId: string): Promise<void>;
  getByClientRequest(userId: string, clientRequestId: string): Promise<{ orderId: string; amountBRL: number } | null>;
}

export interface ISaleEmailService {
  sendSaleConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; qtyBTC: number; unitPriceBRL: number }): Promise<void>;
}

export interface IUserReader2 {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>;
}

export class SellBTCUseCase {
  constructor(
    private quotes: ISellQuoteService,
    private repo: ISellRepository,
    private orders: IOrderStoreSell,
    private users: IUserReader2,
    private email: ISaleEmailService,
  ) {}

  async accept(userId: string, amountBRL: number, clientRequestId: string): Promise<{ orderId: string; status: 'ENQUEUED' | 'PROCESSED'; created: boolean }>{
    if (!clientRequestId || clientRequestId.trim().length === 0) {
      throw new AppError(422, 'INVALID_INPUT', 'clientRequestId is required');
    }
    if (amountBRL <= 0 || !isFinite(amountBRL)) {
      throw new AppError(422, 'INVALID_INPUT', 'amountBRL must be positive');
    }
    const existing = await this.orders.getByClientRequest(userId, clientRequestId);
    if (existing) {
      return { orderId: existing.orderId, status: 'ENQUEUED', created: false };
    }
    // Use current buy quote to validate holdings sufficiency at accept time
    const q = await this.quotes.getBuy().catch((_e) => { throw new AppError(503, 'QUOTE_UNAVAILABLE', 'Quote unavailable'); });
    const qtyNeeded = ceil8(amountBRL / q.priceBRL);
    if (!(await this.repo.hasSufficientHoldings(userId, qtyNeeded))) {
      throw new AppError(422, 'INSUFFICIENT_HOLDINGS', 'Insufficient BTC holdings');
    }
    const { orderId, created } = await this.orders.createOrGet(userId, clientRequestId, amountBRL);
    return { orderId, status: 'ENQUEUED', created };
  }

  async process(userId: string, clientRequestId: string): Promise<void> {
    const order = await this.orders.getByClientRequest(userId, clientRequestId);
    if (!order) return;
    const q = await this.quotes.getBuy();
    const qtyNeeded = ceil8(order.amountBRL / q.priceBRL);
    const { qtySold, creditedBRL } = await this.repo.executeSellTx({
      userId,
      amountBRL: order.amountBRL,
      qtyBTCNeeded: qtyNeeded,
      quotePriceBRL: q.priceBRL,
      clientRequestId,
    });
    await this.orders.markProcessed(order.orderId);
    (async () => {
      try {
        const u = await this.users.findById(userId);
        if (u) await this.email.sendSaleConfirmation({ email: u.email, name: u.name }, { amountBRL: creditedBRL, qtyBTC: qtySold, unitPriceBRL: q.priceBRL });
      } catch { /* ignore */ }
    })();
  }
}

