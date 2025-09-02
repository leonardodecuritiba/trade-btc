import request from 'supertest';
import { app } from '../../src/app';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Volume Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /metrics/daily-volume', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('sums today BUY and SELL correctly and ignores DEPOSIT/REBOOK', async () => {
    const token = await registerAndLogin('vol1@example.com');
    const a = auth(token);
    // seed: deposit, two buys, partial sell generating rebook
    await request(app).post('/deposits').set(a).send({ amountBRL: 300, clientRequestId: 'dep-v1' }).expect(201);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-v1a' }).expect(202);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 200, clientRequestId: 'buy-v1b' }).expect(202);
    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/orders/sell').set(a).send({ amountBRL: 150, clientRequestId: 'sell-v1a' }).expect(202);
    await new Promise(r => setTimeout(r, 250));
    const res = await request(app).get('/metrics/daily-volume').set(a).expect(200);
    // buys: 0.001 + 0.002 = 0.003; sells: 0.0015
    expect(res.body.boughtBTC).toBe(0.003);
    expect(res.body.soldBTC).toBe(0.0015);
  });
});

