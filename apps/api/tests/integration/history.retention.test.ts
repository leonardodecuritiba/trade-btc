import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { PrismaQuoteHistoryRepository } from '../../src/adapters/PrismaQuoteHistoryRepository';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'History Retention Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('RetentionCleaner (manual invocation)', () => {
  it('deletes snapshots older than 90 days', async () => {
    const token = await registerAndLogin('hist-retention@example.com');
    const a = auth(token);
    const repo = new PrismaQuoteHistoryRepository(prisma);
    // Seed one very old snapshot (100 days ago) and one recent snapshot (now)
    const now = new Date();
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - (now.getTime() % (10 * 60 * 1000)));
    await repo.upsertSnapshot(old, { buy: 111000, sell: 110500, source: 'Old' });
    await repo.upsertSnapshot(recent, { buy: 222000, sell: 221500, source: 'Recent' });

    // Ensure both exist in DB
    const before = await prisma.quoteSnapshot.findMany({ where: { ts: { lte: now } } });
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Run cleaner logic manually
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await repo.deleteOlderThan(cutoff);

    // Old snapshot removed, recent remains
    const after = await prisma.quoteSnapshot.findMany({});
    const hasOld = after.some(s => s.ts.getTime() === old.getTime());
    const hasRecent = after.some(s => s.ts.getTime() === recent.getTime());
    expect(hasOld).toBe(false);
    expect(hasRecent).toBe(true);

    // Endpoint still returns 144 items; recent snapshot should appear at or before endTs
    const res = await request(app).get('/quotes/history').set(a).expect(200);
    expect(res.body.items.length).toBe(144);
  });
});

