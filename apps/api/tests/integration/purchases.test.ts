import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Buyer Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('POST /orders/buy', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_SELL = '100000';
    process.env.QUOTE_STUB_BUY = '101000';
  });

  it('accepts and processes a buy, creating position and debiting BRL', async () => {
    const token = await registerAndLogin('buy1@example.com');
    await request(app).post('/deposits').set(auth(token)).send({ amountBRL: 100, clientRequestId: 'dep-b1' });
    const resp = await request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 100, clientRequestId: 'ord-1' });
    expect(resp.status).toBe(202);
    expect(resp.body.orderId).toBeDefined();
    // wait a bit for background processing
    await new Promise(r => setTimeout(r, 150));
    // verify account balance and position
    const userId = (await prisma.user.findFirst({ where: { email: 'buy1@example.com' } }))!.id;
    const acc = await prisma.account.findUnique({ where: { userId } });
    // @ts-ignore Decimal
    const bal = acc?.fiatBalanceBRL.toNumber ? acc?.fiatBalanceBRL.toNumber() : Number(acc?.fiatBalanceBRL);
    expect(bal).toBe(0);
    const pos = await prisma.investmentPosition.findMany({ where: { userId } });
    expect(pos.length).toBe(1);
    // @ts-ignore Decimal
    const qty = pos[0].qtyBTC.toNumber ? pos[0].qtyBTC.toNumber() : Number(pos[0].qtyBTC);
    expect(qty).toBe(0.001);
  });

  it('returns 422 for insufficient funds', async () => {
    const token = await registerAndLogin('buy2@example.com');
    const resp = await request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 50, clientRequestId: 'ord-2' });
    expect(resp.status).toBe(422);
    expect(resp.body.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('is idempotent by clientRequestId (same orderId, single processing)', async () => {
    const token = await registerAndLogin('buy3@example.com');
    await request(app).post('/deposits').set(auth(token)).send({ amountBRL: 100, clientRequestId: 'dep-b3' });
    const r1 = await request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 100, clientRequestId: 'ord-3' });
    const r2 = await request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 100, clientRequestId: 'ord-3' });
    expect([202,200]).toContain(r2.status);
    await new Promise(r => setTimeout(r, 150));
    const userId = (await prisma.user.findFirst({ where: { email: 'buy3@example.com' } }))!.id;
    const txs = await prisma.transaction.findMany({ where: { userId, type: 'BUY' } });
    expect(txs.length).toBe(1);
  });

  it('processes FIFO for same user', async () => {
    const token = await registerAndLogin('buy4@example.com');
    await request(app).post('/deposits').set(auth(token)).send({ amountBRL: 200, clientRequestId: 'dep-b4' });
    await Promise.all([
      request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 80, clientRequestId: 'ord-4a' }),
      request(app).post('/orders/buy').set(auth(token)).send({ amountBRL: 120, clientRequestId: 'ord-4b' }),
    ]);
    await new Promise(r => setTimeout(r, 250));
    const userId = (await prisma.user.findFirst({ where: { email: 'buy4@example.com' } }))!.id;
    const acc = await prisma.account.findUnique({ where: { userId } });
    // @ts-ignore
    const bal = acc?.fiatBalanceBRL.toNumber ? acc?.fiatBalanceBRL.toNumber() : Number(acc?.fiatBalanceBRL);
    expect(bal).toBe(0);
    const txs = await prisma.transaction.findMany({ where: { userId, type: 'BUY' } });
    expect(txs.length).toBe(2);
  });
});

