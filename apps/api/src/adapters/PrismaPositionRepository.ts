import { PrismaClient } from '@prisma/client';
import { IPositionRepo } from '../../../../packages/application/src/use-cases';

export class PrismaPositionRepository implements IPositionRepo {
  constructor(private prisma: PrismaClient) {}

  async findOpenByUser(userId: string) {
    const rows = await this.prisma.investmentPosition.findMany({
      where: {
        userId,
        // only open positions (qtyBTC > 0)
        qtyBTC: { gt: 0 },
      },
    });
    return rows.map(r => ({
      id: r.id,
      openedAt: r.openedAt,
      // @ts-ignore Prisma Decimal
      qtyBTC: r.qtyBTC.toNumber ? r.qtyBTC.toNumber() : Number(r.qtyBTC),
      // @ts-ignore
      unitPriceBRL: r.unitPriceBRL.toNumber ? r.unitPriceBRL.toNumber() : Number(r.unitPriceBRL),
    }));
  }
}
