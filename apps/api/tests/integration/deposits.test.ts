import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import * as jwt from 'jsonwebtoken';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Dep Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

describe('POST /deposits', () => {
  it('creates a deposit, updates balance, and returns 201 with payload', async () => {
    const token = await registerAndLogin('dep1@example.com');
    const res = await request(app)
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountBRL: 100.0, clientRequestId: 'abc-1' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.amountBRL).toBe(100);
    expect(res.body.newBalance).toBe(100);

    const user = jwt.decode(token) as any;
    const acc = await prisma.account.findUnique({ where: { userId: user.sub }, include: { user: true } });
    // @ts-ignore Decimal handling
    expect(acc?.fiatBalanceBRL.toNumber ? acc?.fiatBalanceBRL.toNumber() : Number(acc?.fiatBalanceBRL)).toBe(100);
    const txs = await prisma.transaction.findMany({ where: { userId: user.sub } });
    expect(txs.length).toBe(1);
    const leds = await prisma.ledgerEntry.findMany({ where: { transactionId: txs[0].id } });
    expect(leds.length).toBe(1);
  });

  it('is idempotent for same clientRequestId (returns 200 and no double credit)', async () => {
    const token = await registerAndLogin('dep2@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    const p1 = await request(app).post('/deposits').set(auth).send({ amountBRL: 50, clientRequestId: 'same-1' });
    const p2 = await request(app).post('/deposits').set(auth).send({ amountBRL: 50, clientRequestId: 'same-1' });
    expect([200,201]).toContain(p2.status);
    const user = jwt.decode(token) as any;
    const acc = await prisma.account.findUnique({ where: { userId: user.sub } });
    // @ts-ignore Decimal handling
    const bal = acc?.fiatBalanceBRL.toNumber ? acc?.fiatBalanceBRL.toNumber() : Number(acc?.fiatBalanceBRL);
    expect(bal).toBe(50);
  });

  it('rejects invalid amount (<= 0) with 422', async () => {
    const token = await registerAndLogin('dep3@example.com');
    const res = await request(app)
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountBRL: 0, clientRequestId: 'inv-1' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('does not rollback deposit if email sending fails', async () => {
    process.env.EMAIL_FORCE_FAIL = '1';
    const token = await registerAndLogin('dep4@example.com');
    const res = await request(app)
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountBRL: 20, clientRequestId: 'email-fail-1' });
    expect(res.status).toBe(201);
    process.env.EMAIL_FORCE_FAIL = undefined;
  });

  it('supports two concurrent deposits (distinct clientRequestId) and sums balances', async () => {
    const token = await registerAndLogin('dep5@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    await Promise.all([
      request(app).post('/deposits').set(auth).send({ amountBRL: 30, clientRequestId: 'c1' }),
      request(app).post('/deposits').set(auth).send({ amountBRL: 40, clientRequestId: 'c2' }),
    ]);
    const user = jwt.decode(token) as any;
    const acc = await prisma.account.findUnique({ where: { userId: user.sub } });
    // @ts-ignore Decimal handling
    const bal = acc?.fiatBalanceBRL.toNumber ? acc?.fiatBalanceBRL.toNumber() : Number(acc?.fiatBalanceBRL);
    expect(bal).toBe(70);
  });
});

