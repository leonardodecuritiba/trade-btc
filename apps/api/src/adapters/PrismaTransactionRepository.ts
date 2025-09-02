import { PrismaClient } from '@prisma/client';
import type { ITransactionRepo, StatementType } from '../../../../packages/application/src/use-cases/get-statement';

export class PrismaTransactionRepository implements ITransactionRepo {
  constructor(private prisma: PrismaClient) {}

  async findForStatement(input: { userId: string; from: Date; to: Date; types?: StatementType[]; cursor?: { createdAt: Date; id: string }; limit: number; }) {
    const { userId, from, to, types, cursor, limit } = input;
    const whereBase: any = {
      userId,
      createdAt: { gte: from, lte: to },
    };
    if (types && types.length) {
      whereBase.type = { in: types as any };
    }
    const where = cursor ? {
      AND: [
        whereBase,
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { AND: [ { createdAt: cursor.createdAt }, { id: { lt: cursor.id } } ] },
          ],
        },
      ],
    } : whereBase;

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const slice = rows.slice(0, limit);
    const last = slice[slice.length - 1];
    const nextCursor = rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : undefined;
    const mapped = slice.map((t) => ({
      id: t.id,
      type: t.type as any,
      createdAt: t.createdAt,
      // @ts-ignore Decimal
      amountBRL: t.amountBRL == null ? null : (t.amountBRL.toNumber ? t.amountBRL.toNumber() : Number(t.amountBRL)),
      // @ts-ignore Decimal
      qtyBTC: t.qtyBTC == null ? null : (t.qtyBTC.toNumber ? t.qtyBTC.toNumber() : Number(t.qtyBTC)),
      // @ts-ignore Decimal
      quotePriceBRL: t.quotePriceBRL == null ? null : (t.quotePriceBRL.toNumber ? t.quotePriceBRL.toNumber() : Number(t.quotePriceBRL)),
    }));
    return { rows: mapped, hasMore: rows.length > limit, nextCursor };
  }
}

