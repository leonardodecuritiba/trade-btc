import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export function getRedis() {
  if (!client) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    client = createClient({ url: redisUrl });
    client.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Redis error', err);
    });
    // lazy connect: middleware ensures connection when needed
  }
  return client;
}

export async function closeRedis() {
  if (client && (client as any).isOpen) {
    try { await client.quit(); } catch { /* ignore */ }
  }
  client = null;
}
