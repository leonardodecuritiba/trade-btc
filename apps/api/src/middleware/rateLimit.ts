import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../packages/shared/src/errors';

type KeyFn = (req: Request) => string;

type SimpleRedis = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<any>;
  ttl: (key: string) => Promise<number>;
  isOpen?: boolean;
};

interface RateLimitOptions {
  client: SimpleRedis;
  windowSec: number;
  max: number;
  key: KeyFn;
}

export function rateLimit(options: RateLimitOptions) {
  const { client, windowSec, max, key } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!client) return next();
      const isOpen = (client as any).isOpen;
      if (!isOpen && typeof (client as any).connect === 'function') {
        try { await (client as any).connect(); } catch { return next(); }
      }
      const k = key(req);
      const now = Date.now();
      const ttl = windowSec;
      const current = await client.incr(k);
      if (current === 1) {
        await client.expire(k, ttl);
      }
      if (current > max) {
        const retryAfter = await client.ttl(k);
        res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
        throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.');
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
