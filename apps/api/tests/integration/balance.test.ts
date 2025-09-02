import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import * as jwt from 'jsonwebtoken';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Bal Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

describe('GET /balance', () => {
  it('returns 0.00 for a new account', async () => {
    const token = await registerAndLogin('bal0@example.com');
    const res = await request(app).get('/balance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.balanceBRL).toBe(0);
    expect(res.body.currency).toBe('BRL');
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('returns updated balance after a deposit', async () => {
    const token = await registerAndLogin('bal1@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/deposits').set(auth).send({ amountBRL: 100, clientRequestId: 'b1' });
    const res = await request(app).get('/balance').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.balanceBRL).toBe(100);
  });

  it('rate-limits balance route', async () => {
    const token = await registerAndLogin('bal2@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    const max = Number(process.env.RATE_LIMIT_MAX_BALANCE || 30);
    let last = 200;
    for (let i = 0; i < max + 2; i++) {
      const r = await request(app).get('/balance').set(auth);
      last = r.status;
    }
    expect(last).toBe(429);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/balance');
    expect(res.status).toBe(401);
  });
});

