import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Pos Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /positions', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '121000';
    // Keep SELL aligned so that qtyBTC = 0.001 for amountBRL=100
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('lists open positions with calculations using single snapshot', async () => {
    const token = await registerAndLogin('pos1@example.com');
    const a = auth(token);
    // deposit and two buys
    await request(app).post('/deposits').set(a).send({ amountBRL: 200, clientRequestId: 'dep-p1' });
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-p1' });
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-p2' });
    await new Promise(r => setTimeout(r, 200));
    const res = await request(app).get('/positions').set(a);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('positionId');
    expect(res.body[0]).toHaveProperty('currentPriceBRL', 121000);
    // invested for one 100 and current gross 121 (approx via 0.001 * 121000)
    expect(res.body[0].investedBRL).toBe(100);
    expect(res.body[0].currentGrossBRL).toBe(121);
  });
});
