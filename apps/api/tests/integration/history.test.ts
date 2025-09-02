import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'History Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /quotes/history', () => {
  it('returns 144 items and preserves gaps', async () => {
    const token = await registerAndLogin('hist1@example.com');
    const a = auth(token);
    // Seed two snapshots around now aligned to 10m boundaries
    const now = new Date();
    const floored = new Date(now.getTime() - (now.getTime() % (10 * 60 * 1000)));
    const earlier = new Date(floored.getTime() - 30 * 60 * 1000);
    await prisma.quoteSnapshot.create({ data: { ts: earlier, buy: 101000, sell: 100000, source: 'Stub' } });
    await prisma.quoteSnapshot.create({ data: { ts: floored, buy: 102000, sell: 100500, source: 'Stub' } });

    const res = await request(app).get('/quotes/history').set(a).expect(200);
    expect(res.body).toHaveProperty('slots', 144);
    expect(res.body.items.length).toBe(144);
    // The two seeded snapshots should appear, and an in-between slot should be null
    const hasFloored = res.body.items.find((i: any) => new Date(i.ts).getTime() === floored.getTime());
    expect(hasFloored.buy).toBe(102000);
    const mid = new Date(floored.getTime() - 20 * 60 * 1000);
    const gap = res.body.items.find((i: any) => new Date(i.ts).getTime() === mid.getTime());
    expect(gap.buy).toBeNull();
  });
});

