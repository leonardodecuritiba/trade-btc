import request from 'supertest';
import { app } from '../../src/app';
import { getRedis } from '../../src/lib/redis';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Quote Fail Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /positions (quote unavailable)', () => {
  beforeAll(async () => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_FAIL = '1';
    // Ensure cache is empty
    const redis = getRedis();
    if (!(redis as any).isOpen) {
      await (redis as any).connect().catch(() => {});
    }
    try { await redis.del('quotes:BTCBRL:current'); } catch { /* ignore */ }
  });

  it('responds 503 POSITION_PRICE_UNAVAILABLE when no quote and no cache', async () => {
    const token = await registerAndLogin('pos-quote-fail@example.com');
    const res = await request(app).get('/positions').set(auth(token));
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('code', 'POSITION_PRICE_UNAVAILABLE');
  });
});

