import type { IQuoteCache } from '../../../../../packages/application/src/use-cases/get-current-quote';
import type { RedisClientType } from 'redis';

export class RedisQuoteCache implements IQuoteCache {
  private key = 'quotes:BTCBRL:current';
  constructor(private client: RedisClientType) {}

  async get() {
    if (!this.client || !(this.client as any).isOpen) return null;
    const raw = await this.client.get(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(value: { buy: number; sell: number; source: string; ts: string }) {
    if (!this.client || !(this.client as any).isOpen) return;
    const ttlSec = Number(process.env.QUOTE_CACHE_TTL_SECONDS || 10);
    await this.client.set(this.key, JSON.stringify(value), { EX: ttlSec });
  }
}

