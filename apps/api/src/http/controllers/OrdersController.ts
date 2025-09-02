import { Request, Response } from 'express';
import { z } from 'zod';
import { BuyBTCUseCase } from '../../../../../packages/application/src/use-cases/buy-btc';
import { SellBTCUseCase } from '../../../../../packages/application/src/use-cases/sell-btc';
import { baseLogger } from '../../lib/logger';
import { Queue } from 'bullmq';

const buySchema = z.object({
  amountBRL: z.number().positive(),
  clientRequestId: z.string().min(1),
});

// Simple per-user in-memory FIFO chain to simulate worker FIFO
const userChains = new Map<string, Promise<any>>();

export class OrdersController {
  constructor(private buyUC: BuyBTCUseCase, private sellUC?: SellBTCUseCase) {}

  async buy(req: Request, res: Response) {
    const data = buySchema.parse(req.body);
    const userId = (req as any).user?.id as string;
    const accepted = await this.buyUC.accept(userId, data.amountBRL, data.clientRequestId);
    // If a worker is enabled, publish to BullMQ per-user queue; otherwise fallback to in-memory FIFO chain
    if (process.env.USE_WORKER === '1') {
      const queueName = `orders:${userId}`;
      const queue = new Queue(queueName, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
      await queue.add('buy', { userId, clientRequestId: data.clientRequestId }, { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 500 } });
      await queue.close();
    } else {
      const prev = userChains.get(userId) || Promise.resolve();
      const next = prev.then(() => this.buyUC.process(userId, data.clientRequestId)).catch(() => {/* ignore */});
      userChains.set(userId, next);
    }
    const statusCode = accepted.created ? 202 : 200;
    return res.status(statusCode).json({ orderId: accepted.orderId, status: 'ENQUEUED' });
  }

  async sell(req: Request, res: Response) {
    const data = buySchema.parse(req.body); // same shape: amountBRL, clientRequestId
    const userId = (req as any).user?.id as string;
    if (!this.sellUC) throw new Error('Sell use case not configured');
    const logger = (res.locals && res.locals.logger) || baseLogger;
    logger.info({ userId, clientRequestId: data.clientRequestId, amountBRL: data.amountBRL }, 'sell - accept start');
    const accepted = await this.sellUC.accept(userId, data.amountBRL, data.clientRequestId);
    if (process.env.USE_WORKER === '1') {
      const queueName = `orders:${userId}`;
      const queue = new Queue(queueName, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
      await queue.add('sell', { userId, clientRequestId: data.clientRequestId }, { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 500 } });
      await queue.close();
    } else {
      const prev = userChains.get(userId) || Promise.resolve();
      const next = prev.then(() => this.sellUC!.process(userId, data.clientRequestId)).catch(() => {/* ignore */});
      userChains.set(userId, next);
    }
    const statusCode = accepted.created ? 202 : 200;
    logger.info({ userId, clientRequestId: data.clientRequestId, orderId: accepted.orderId, created: accepted.created }, 'sell - accept end');
    return res.status(statusCode).json({ orderId: accepted.orderId, status: 'ENQUEUED' });
  }
}
