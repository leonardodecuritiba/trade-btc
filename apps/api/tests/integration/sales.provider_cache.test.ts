import request from 'supertest';
import { app } from '../../src/app';
import { getRedis } from '../../src/lib/redis';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Seller Cache Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('POST /orders/sell (provider down + cache valid)', () => {
  it('uses cache when provider fails, otherwise 503', async () => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_FAIL = '0';
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';

    const token = await registerAndLogin('sell-cache@example.com');
    const a = auth(token);

    // Warm the cache
    await request(app).get('/quotes/current').set(a).expect(200);

    // Fail provider but keep cache
    process.env.QUOTE_STUB_FAIL = '1';

    // Need some holdings for selling
    await request(app).post('/deposits').set(a).send({ amountBRL: 100, clientRequestId: 'dep-sc1' }).expect(201);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-sc1' }).expect(202);
    await new Promise(r => setTimeout(r, 150));

    // Should accept using cached quote even if provider fails
    const rOk = await request(app).post('/orders/sell').set(a).send({ amountBRL: 50, clientRequestId: 'sell-sc1' });
    expect([202,200]).toContain(rOk.status);

    // Clear cache and then expect 503
    const redis = getRedis();
    if (!(redis as any).isOpen) { try { await (redis as any).connect(); } catch {} }
    try { await redis.del('quotes:BTCBRL:current'); } catch {}

    const r503 = await request(app).post('/orders/sell').set(a).send({ amountBRL: 10, clientRequestId: 'sell-sc2' });
    expect(r503.status).toBe(503);
    expect(r503.body.code).toBe('QUOTE_UNAVAILABLE');
  });
});

