import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Seller Total Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('POST /orders/sell (total sale)', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('consumes all positions and leaves zero open', async () => {
    const token = await registerAndLogin('sell-total@example.com');
    const a = auth(token);
    await request(app).post('/deposits').set(a).send({ amountBRL: 300, clientRequestId: 'dep-st1' }).expect(201);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-st1a' }).expect(202);
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 200, clientRequestId: 'buy-st1b' }).expect(202);
    await new Promise(r => setTimeout(r, 150));

    const resp = await request(app).post('/orders/sell').set(a).send({ amountBRL: 300, clientRequestId: 'sell-st1' });
    expect([202,200]).toContain(resp.status);
    await new Promise(r => setTimeout(r, 200));

    const userId = (await prisma.user.findFirst({ where: { email: 'sell-total@example.com' } }))!.id;
    const pos = await prisma.investmentPosition.findMany({ where: { userId, qtyBTC: { gt: 0 } } });
    expect(pos.length).toBe(0);

    const acc = await prisma.account.findUnique({ where: { userId } });
    const bal = Number((acc as any).fiatBalanceBRL.toNumber ? (acc as any).fiatBalanceBRL.toNumber() : acc?.fiatBalanceBRL);
    expect(bal).toBe(300);
  });
});

