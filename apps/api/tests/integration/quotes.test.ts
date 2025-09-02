import request from 'supertest';
import { app } from '../../src/app';
import { getRedis } from '../../src/lib/redis';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Quote Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

describe('GET /quotes/current', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_SOURCE = 'MercadoBitcoin';
    process.env.QUOTE_STUB_BUY = '101';
    process.env.QUOTE_STUB_SELL = '100';
  });

  it('miss + provider OK returns 200 and populates cache', async () => {
    const token = await registerAndLogin('quotes1@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    const res = await request(app).get('/quotes/current').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.buy).toBe(101);
    expect(res.body.sell).toBe(100);
    expect(res.body.source).toBe('MercadoBitcoin');
  });

  it('hit returns from cache and ageMs increases', async () => {
    const token = await registerAndLogin('quotes2@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    process.env.QUOTE_STUB_BUY = '150';
    let r1 = await request(app).get('/quotes/current').set(auth);
    const age1 = r1.body.ageMs;
    let r2 = await request(app).get('/quotes/current').set(auth);
    expect(r2.status).toBe(200);
    expect(r2.body.buy).toBe(r1.body.buy); // still cached
    expect(r2.body.ageMs).toBeGreaterThanOrEqual(age1);
  });

  it('provider fails + cache valid returns cached; fails with 503 when no cache', async () => {
    const token = await registerAndLogin('quotes3@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    process.env.QUOTE_STUB_BUY = '200';
    await request(app).get('/quotes/current').set(auth); // populate cache
    process.env.QUOTE_STUB_FAIL = '1';
    const rCached = await request(app).get('/quotes/current').set(auth);
    expect(rCached.status).toBe(200);
    // flush cache and try again
    const redis = getRedis();
    if ((redis as any).isOpen) {
      await (redis as any).del('quotes:BTCBRL:current');
    }
    const r503 = await request(app).get('/quotes/current').set(auth);
    expect(r503.status).toBe(503);
    expect(r503.body.code).toBe('PROVIDER_UNAVAILABLE');
    process.env.QUOTE_STUB_FAIL = undefined;
  });
});

