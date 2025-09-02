import { PrismaClient } from '@prisma/client';
import { IBuyRepository } from '../../../../packages/application/src/use-cases/buy-btc';

export class PrismaBuyRepository implements IBuyRepository {
  constructor(private prisma: PrismaClient) {}

  async hasSufficientBalance(userId: string, amountBRL: number): Promise<boolean> {
    const acc = await this.prisma.account.findUnique({ where: { userId } });
    const bal = Number(acc?.fiatBalanceBRL ?? 0);
    return bal >= amountBRL;
  }

  async executeBuyTx(input: { userId: string; amountBRL: number; qtyBTC: number; quotePriceBRL: number; clientRequestId: string }) {
    const { userId, amountBRL, qtyBTC, quotePriceBRL, clientRequestId } = input;
    return this.prisma.$transaction(async (tx) => {
      const acc = await tx.account.findUniqueOrThrow({ where: { userId } });
      const current = Number(acc.fiatBalanceBRL);
      if (current < amountBRL) {
        throw new Error('Insufficient funds');
      }
      const t = await tx.transaction.create({
        data: {
          userId,
          type: 'BUY',
          clientRequestId,
          amountBRL,
          qtyBTC,
          quotePriceBRL,
        },
      });
      await tx.ledgerEntry.createMany({
        data: [
          {
            accountId: acc.id,
            transactionId: t.id,
            direction: 'DEBIT',
            currency: 'BRL',
            amount: amountBRL,
          },
          {
            accountId: acc.id,
            transactionId: t.id,
            direction: 'CREDIT',
            currency: 'BTC',
            amount: qtyBTC,
          },
        ],
      });
      await tx.investmentPosition.create({
        data: {
          userId,
          qtyBTC,
          unitPriceBRL: quotePriceBRL,
        },
      });
      await tx.account.update({ where: { id: acc.id }, data: { fiatBalanceBRL: { decrement: amountBRL } } });
      return { transactionId: t.id, positionId: '' };
    });
  }
}

