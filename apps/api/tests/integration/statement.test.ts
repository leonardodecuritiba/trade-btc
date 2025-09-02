import request from 'supertest';
import { app } from '../../src/app';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Statement Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /statement', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('returns last 90 days by default, supports filters and pagination', async () => {
    const token = await registerAndLogin('stmt1@example.com');
    const a = auth(token);
    // Seed: 2 deposits, 2 buys, 1 partial sell (REBOOK), 1 total sell
    await request(app).post('/deposits').set(a).send({ amountBRL: 300, clientRequestId: 'dep-stm1a' }).expect(201);
    await request(app).post('/deposits').set(a).send({ amountBRL: 100, clientRequestId: 'dep-stm1b' }).expect(201);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-stm1a' }).expect(202);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 200, clientRequestId: 'buy-stm1b' }).expect(202);
    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/orders/sell').set(a).send({ amountBRL: 150, clientRequestId: 'sell-stm1a' }).expect(202);
    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/orders/sell').set(a).send({ amountBRL: 150, clientRequestId: 'sell-stm1b' }).expect(202);
    await new Promise(r => setTimeout(r, 200));

    // Default
    const res = await request(app).get('/statement').set(a).expect(200);
    expect(res.body).toHaveProperty('items');
    const types = res.body.items.map((i: any) => i.type);
    expect(types).toEqual(expect.arrayContaining(['DEPOSIT', 'BUY', 'SELL', 'REBOOK']));
    // Ensure SELL + REBOOK both present at least once
    const hasSell = res.body.items.some((i: any) => i.type === 'SELL');
    const hasRebook = res.body.items.some((i: any) => i.type === 'REBOOK');
    expect(hasSell && hasRebook).toBe(true);

    // Filter by types BUY,SELL
    const res2 = await request(app).get('/statement').set(a).query({ types: 'BUY,SELL' }).expect(200);
    const t2 = new Set(res2.body.items.map((i: any) => i.type));
    expect(t2.has('DEPOSIT')).toBe(false);
    expect(t2.has('REBOOK')).toBe(false);

    // Pagination: limit 2
    const res3 = await request(app).get('/statement').set(a).query({ limit: 2 }).expect(200);
    expect(res3.body.items.length).toBe(2);
    const cursor = res3.body.page.nextCursor;
    expect(cursor).toBeDefined();
    const res4 = await request(app).get('/statement').set(a).query({ limit: 2, cursor }).expect(200);
    expect(res4.body.items.length).toBeGreaterThan(0);
  });

  it('returns 422 for invalid range', async () => {
    const token = await registerAndLogin('stmt2@example.com');
    const a = auth(token);
    const from = new Date('2024-01-02T00:00:00Z').toISOString();
    const to = new Date('2024-01-01T00:00:00Z').toISOString();
    const res = await request(app).get('/statement').set(a).query({ from, to });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_RANGE');
  });
});
