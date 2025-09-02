import { PrismaClient } from '@prisma/client';
import type { IQuoteHistoryRepo } from '../../../../packages/application/src/use-cases/get-history-24h';

export class PrismaQuoteHistoryRepository implements IQuoteHistoryRepo {
  constructor(private prisma: PrismaClient) {}
  async findSnapshots(from: Date, to: Date) {
    const rows = await this.prisma.quoteSnapshot.findMany({
      where: { ts: { gte: from, lte: to } },
      orderBy: { ts: 'asc' },
    });
    return rows.map(r => ({
      ts: r.ts,
      // @ts-ignore Decimal
      buy: r.buy == null ? null : (r.buy.toNumber ? r.buy.toNumber() : Number(r.buy)),
      // @ts-ignore Decimal
      sell: r.sell == null ? null : (r.sell.toNumber ? r.sell.toNumber() : Number(r.sell)),
      source: r.source ?? null,
    }));
  }

  async upsertSnapshot(ts: Date, data: { buy?: number | null; sell?: number | null; source?: string | null }) {
    await this.prisma.quoteSnapshot.upsert({
      where: { ts },
      create: { ts, buy: data.buy ?? null, sell: data.sell ?? null, source: data.source ?? null },
      update: { buy: data.buy ?? null, sell: data.sell ?? null, source: data.source ?? null },
    });
  }

  async deleteOlderThan(cutoff: Date) {
    await this.prisma.quoteSnapshot.deleteMany({ where: { ts: { lt: cutoff } } });
  }
}
