import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { baseLogger } from '../../api/src/lib/logger';
import { PrismaClient } from '@prisma/client';
import { BuyBTCUseCase } from '../../../packages/application/src/use-cases/buy-btc';
import { SellBTCUseCase } from '../../../packages/application/src/use-cases/sell-btc';
import { GetCurrentQuoteUseCase } from '../../../packages/application/src/use-cases/get-current-quote';
import { PrismaOrderRepository } from '../../api/src/adapters/PrismaOrderRepository';
import { PrismaBuyRepository } from '../../api/src/adapters/PrismaBuyRepository';
import { PrismaSellOrderRepository } from '../../api/src/adapters/PrismaSellOrderRepository';
import { PrismaSellRepository } from '../../api/src/adapters/PrismaSellRepository';
import { PrismaUserReader } from '../../api/src/adapters/PrismaUserReader';
import { SendgridEmailService } from '../../api/src/adapters/SendgridEmailService';
import { RedisQuoteCache } from '../../api/src/adapters/quotes/RedisQuoteCache';
import { StubQuoteProvider } from '../../api/src/adapters/quotes/StubQuoteProvider';
import { MercadoBitcoinProvider } from '../../api/src/adapters/quotes/MercadoBitcoinProvider';
import { PrismaQuoteHistoryRepository } from '../../api/src/adapters/PrismaQuoteHistoryRepository';
import { GetCurrentQuoteUseCase } from '../../../packages/application/src/use-cases/get-current-quote';
import { RedisQuoteCache } from '../../api/src/adapters/quotes/RedisQuoteCache';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const prisma = new PrismaClient();

async function buildBuyUC() {
  const orderRepo = new PrismaOrderRepository(prisma);
  const buyRepo = new PrismaBuyRepository(prisma);
  const emailSvc = new SendgridEmailService();
  const userReader = new PrismaUserReader(prisma);

  const connection = { url: REDIS_URL } as any;
  const ioredisClient: any = { isOpen: false };
  // RedisQuoteCache expects a node-redis client type with get/set
  // For simplicity, re-create a tiny cache using bullmq's connection is not feasible; use global fetch via provider only
  const quotesCache = new RedisQuoteCache((global as any).__redisClient || (require('redis').createClient({ url: REDIS_URL })));
  if (!(global as any).__redisClient) {
    (global as any).__redisClient = quotesCache['client'];
    await (global as any).__redisClient.connect().catch(() => {});
  }
  const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub' ? new StubQuoteProvider() : new MercadoBitcoinProvider();
  const quotesUC = new GetCurrentQuoteUseCase(quotesCache as any, provider);

  const quoteService = {
    getSell: async (): Promise<{ priceBRL: number; ts: string }> => {
      const dto = await quotesUC.execute();
      return { priceBRL: dto.sell, ts: dto.ts };
    }
  };

  return new BuyBTCUseCase(quoteService, buyRepo, orderRepo, userReader, emailSvc);
}

async function main() {
  const buyUC = await buildBuyUC();
  // Build Sell UC
  const sellOrderRepo = new PrismaSellOrderRepository(prisma);
  const sellRepo = new PrismaSellRepository(prisma);
  // Reuse the same cache/provider path but use buy side for sells
  const quotesCache = new RedisQuoteCache((global as any).__redisClient || (require('redis').createClient({ url: REDIS_URL })));
  if (!(global as any).__redisClient) {
    (global as any).__redisClient = quotesCache['client'];
    await (global as any).__redisClient.connect().catch(() => {});
  }
  const provider2 = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub' ? new StubQuoteProvider() : new MercadoBitcoinProvider();
  const quotesUC2 = new GetCurrentQuoteUseCase(quotesCache as any, provider2);
  const sellQuoteService = {
    getBuy: async (): Promise<{ priceBRL: number; ts: string }> => {
      const dto = await quotesUC2.execute();
      return { priceBRL: dto.buy, ts: dto.ts };
    }
  };
  const emailSvc2 = new SendgridEmailService();
  const userReader2 = new PrismaUserReader(prisma);
  const sellUC = new SellBTCUseCase(sellQuoteService, sellRepo, sellOrderRepo, userReader2, emailSvc2);

  // Create workers per-user (current users) and poll for new ones
  const started = new Set<string>();
  async function startWorkersForUsers() {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      const qname = `orders:${u.id}`;
      if (started.has(qname)) continue;
      // One worker per user queue, FIFO by default with concurrency 1
      const worker = new Worker(qname, async (job) => {
        const { userId, clientRequestId } = job.data as { userId: string; clientRequestId: string };
        const kind = job.name === 'sell' ? 'sell' : 'buy';
        baseLogger.info({ queue: qname, kind, userId, clientRequestId, jobId: job.id }, 'worker - job start');
        try {
          if (kind === 'sell') {
            await sellUC.process(userId, clientRequestId);
          } else {
            await buyUC.process(userId, clientRequestId);
          }
          baseLogger.info({ queue: qname, kind, userId, clientRequestId, jobId: job.id }, 'worker - job done');
        } catch (err) {
          baseLogger.error({ queue: qname, kind, userId, clientRequestId, jobId: job.id, err }, 'worker - job error');
          throw err;
        }
      }, { connection: { url: REDIS_URL }, concurrency: 1 });
      started.add(qname);
      console.log(`Worker started for ${qname}`);
    }
  }

  await startWorkersForUsers();
  setInterval(startWorkersForUsers, 5000);

  // Start history collector (every minute) and retention cleaner (hourly) when enabled
  if (process.env.HISTORY_JOBS === '1') {
    startHistoryJobs();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// ---- History Jobs ----
function floor10minInTZ(date: Date, timeZone: string): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const y = get('year'), m = get('month'), d = get('day'), H = get('hour'), M = Math.floor(get('minute') / 10) * 10;
  // Convert intended TZ parts to UTC
  let guess = new Date(Date.UTC(y, m - 1, d, H, M, 0, 0));
  const parts2 = fmt.formatToParts(guess);
  const get2 = (t: string) => Number(parts2.find(p => p.type === t)?.value);
  const dH = H - get2('hour'); const dM = M - get2('minute');
  guess = new Date(guess.getTime() + dH * 3600_000 + dM * 60_000);
  return guess;
}

function startHistoryJobs() {
  const repo = new PrismaQuoteHistoryRepository(prisma);
  const redisClient = getRedis();
  if (!(redisClient as any).isOpen) { (async () => { try { await (redisClient as any).connect(); } catch {} })(); }
  const tz = 'America/Sao_Paulo';

  async function collectOnce() {
    try {
      const slotTs = floor10minInTZ(new Date(), tz);
      // fetch quote via GetCurrentQuoteUseCase with cache+provider
      const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub' ? new StubQuoteProvider() : new MercadoBitcoinProvider();
      const quotesUC = new GetCurrentQuoteUseCase(new RedisQuoteCache(redisClient as any), provider);
      const q = await quotesUC.execute();
      await repo.upsertSnapshot(slotTs, { buy: q.buy, sell: q.sell, source: q.source });
    } catch (e) {
      // swallow; gaps are acceptable per spec
    }
  }

  async function cleanOnce() {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 3600_000);
      await repo.deleteOlderThan(cutoff);
    } catch {}
  }

  // run every minute for collector
  setInterval(collectOnce, 60 * 1000);
  // run daily for cleaner (per spec)
  setInterval(cleanOnce, 24 * 60 * 60 * 1000);
}
