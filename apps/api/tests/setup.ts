import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH || '.env.test' });

import { prisma } from '../src/lib/prisma';
import { createClient } from 'redis';
import { closeRedis } from '../src/lib/redis';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect().catch(() => {/* ignore for local runs without redis */});

beforeEach(async () => {
  // Clean DB respecting FK order
  await prisma.ledgerEntry.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.investmentPosition.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.quoteSnapshot.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  if ((redis as any).isOpen) {
    try { await redis.flushAll(); } catch {}
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  if ((redis as any).isOpen) {
    try { await redis.quit(); } catch {}
  }
  await closeRedis();
});
