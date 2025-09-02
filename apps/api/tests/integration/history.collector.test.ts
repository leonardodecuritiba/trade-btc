import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { PrismaQuoteHistoryRepository } from '../../src/adapters/PrismaQuoteHistoryRepository';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'History Collector Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('HistoryCollector simulation', () => {
  it('upserts a snapshot at endTs and endpoint reflects it', async () => {
    const token = await registerAndLogin('hist-collector@example.com');
    const a = auth(token);
    // First call: get endTs of current window
    const first = await request(app).get('/quotes/history').set(a).expect(200);
    const endTs: string = first.body.endTs;
    const repo = new PrismaQuoteHistoryRepository(prisma);
    // Simulate collector upsert at the latest slot
    await repo.upsertSnapshot(new Date(endTs), { buy: 123456, sell: 123000, source: 'Test' });
    // Call again and assert last slot has the inserted values
    const second = await request(app).get('/quotes/history').set(a).expect(200);
    const last = second.body.items[second.body.items.length - 1];
    expect(new Date(last.ts).toISOString()).toBe(new Date(endTs).toISOString());
    expect(last.buy).toBe(123456);
    expect(last.sell).toBe(123000);
    expect(last.source).toBe('Test');
  });
});

