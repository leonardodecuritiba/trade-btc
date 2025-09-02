import { PrismaClient } from '@prisma/client';
import type { IDailyVolumeRepo } from '../../../../packages/application/src/use-cases/get-daily-volume';

export class PrismaDailyVolumeRepository implements IDailyVolumeRepo {
  constructor(private prisma: PrismaClient) {}

  async sumQtyBTC(where: { type: 'BUY' | 'SELL'; from: Date; to: Date }): Promise<number> {
    const res = await this.prisma.transaction.aggregate({
      _sum: { qtyBTC: true },
      where: {
        type: where.type,
        createdAt: { gte: where.from, lte: where.to },
      },
    });
    // @ts-ignore Decimal
    const v = res._sum.qtyBTC?.toNumber ? res._sum.qtyBTC.toNumber() : Number(res._sum.qtyBTC || 0);
    return v || 0;
  }
}

