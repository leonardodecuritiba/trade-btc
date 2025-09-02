import { PrismaClient } from '@prisma/client';
import { ISellRepository } from '../../../../packages/application/src/use-cases/sell-btc';
import { bankersRound2 } from '../../../../packages/shared/src/money';

export class PrismaSellRepository implements ISellRepository {
  constructor(private prisma: PrismaClient) {}

  async hasSufficientHoldings(userId: string, qtyBTCNeeded: number): Promise<boolean> {
    const rows = await this.prisma.investmentPosition.findMany({ where: { userId } });
    const total = rows.reduce((acc, r) => acc + Number((r as any).qtyBTC.toNumber ? (r as any).qtyBTC.toNumber() : r.qtyBTC), 0);
    return total >= qtyBTCNeeded - 1e-12;
  }

  async executeSellTx(input: { userId: string; amountBRL: number; qtyBTCNeeded: number; quotePriceBRL: number; clientRequestId: string }) {
    const { userId, qtyBTCNeeded, quotePriceBRL, clientRequestId } = input;
    return this.prisma.$transaction(async (tx) => {
      const positions = await tx.investmentPosition.findMany({ where: { userId, qtyBTC: { gt: 0 } }, orderBy: { openedAt: 'asc' } });
      let remaining = qtyBTCNeeded;
      let qtySold = 0;
      // Consume FIFO
      for (const p of positions) {
        if (remaining <= 0) break;
        const qty = Number((p as any).qtyBTC.toNumber ? (p as any).qtyBTC.toNumber() : p.qtyBTC);
        if (qty <= remaining + 1e-12) {
          // fully consume
          qtySold += qty;
          remaining = Math.max(0, remaining - qty);
          await tx.investmentPosition.update({ where: { id: p.id }, data: { qtyBTC: 0 } });
        } else {
          // partial: close original and rebook residual at original unit price
          const soldHere = remaining;
          const residual = qty - remaining;
          qtySold += soldHere;
          remaining = 0;
          await tx.investmentPosition.update({ where: { id: p.id }, data: { qtyBTC: 0 } });
          await tx.investmentPosition.create({ data: { userId, qtyBTC: residual, unitPriceBRL: p.unitPriceBRL, openedAt: p.openedAt } });
          // Record REBOOK transaction for audit purposes
          await tx.transaction.create({ data: { userId, type: 'REBOOK', clientRequestId: `${clientRequestId}:REBOOK:${p.id}`, qtyBTC: residual, quotePriceBRL: p.unitPriceBRL } });
        }
      }
      if (qtySold + 1e-12 < qtyBTCNeeded) {
        throw new Error('Insufficient holdings during processing');
      }
      const creditedBRL = bankersRound2(qtySold * quotePriceBRL);
      // Create SELL transaction and ledger
      const t = await tx.transaction.create({
        data: {
          userId,
          type: 'SELL',
          clientRequestId,
          amountBRL: creditedBRL,
          qtyBTC: qtySold,
          quotePriceBRL: quotePriceBRL,
        },
      });
      const acc = await tx.account.findUniqueOrThrow({ where: { userId } });
      await tx.ledgerEntry.createMany({
        data: [
          { accountId: acc.id, transactionId: t.id, direction: 'DEBIT', currency: 'BTC', amount: qtySold },
          { accountId: acc.id, transactionId: t.id, direction: 'CREDIT', currency: 'BRL', amount: creditedBRL },
        ],
      });
      await tx.account.update({ where: { id: acc.id }, data: { fiatBalanceBRL: { increment: creditedBRL } } });
      return { transactionId: t.id, qtySold, creditedBRL };
    });
  }
}

