import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Seller Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('POST /orders/sell', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    // buy side used for selling; set SELL=100000 to make buy qty BTC exact 0.001 and 0.002
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('accepts and processes a sale (FIFO) and credits BRL with REBOOK on partial last', async () => {
    const token = await registerAndLogin('sell1@example.com');
    const a = auth(token);
    // seed: deposit and two buys to create positions
    await request(app).post('/deposits').set(a).send({ amountBRL: 300, clientRequestId: 'dep-s1' });
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 100, clientRequestId: 'buy-s1a' }); // qty=0.001
    await request(app).post('/orders/buy').set(a).send({ amountBRL: 200, clientRequestId: 'buy-s1b' }); // qty=0.002
    await new Promise(r => setTimeout(r, 150));

    // sell 150 BRL at buy=100000 -> qtyNeeded=0.0015 (ceil8 not needed but exact)
    const resp = await request(app).post('/orders/sell').set(a).send({ amountBRL: 150, clientRequestId: 'sell-s1' });
    expect([202,200]).toContain(resp.status);
    await new Promise(r => setTimeout(r, 200));

    const userId = (await prisma.user.findFirst({ where: { email: 'sell1@example.com' } }))!.id;
    const acc = await prisma.account.findUnique({ where: { userId } });
    const bal = Number((acc as any).fiatBalanceBRL.toNumber ? (acc as any).fiatBalanceBRL.toNumber() : acc?.fiatBalanceBRL);
    // After buys: 0.00; after sell credited ~150.00
    expect(bal).toBe(150);

    const pos = await prisma.investmentPosition.findMany({ where: { userId, qtyBTC: { gt: 0 } }, orderBy: { openedAt: 'asc' } });
    // Expect two positions open: residual 0.0015 in the second (REBOOK), and maybe full in second case depends on split
    const totalQty = pos.reduce((s, p) => s + Number((p as any).qtyBTC.toNumber ? (p as any).qtyBTC.toNumber() : p.qtyBTC), 0);
    expect(totalQty).toBeCloseTo(0.0015, 8); // remaining 0.0015 BTC
  });

  it('returns 422 when holdings are insufficient', async () => {
    const token = await registerAndLogin('sell2@example.com');
    const a = auth(token);
    // no buys; try selling
    const resp = await request(app).post('/orders/sell').set(a).send({ amountBRL: 10, clientRequestId: 'sell-s2' });
    expect(resp.status).toBe(422);
    expect(resp.body.code).toBe('INSUFFICIENT_HOLDINGS');
  });
});
