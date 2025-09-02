import { PrismaClient } from '@prisma/client';
import { IDepositRepository } from '../../../../packages/application/src/use-cases/deposit';

export class PrismaDepositRepository implements IDepositRepository {
  constructor(private prisma: PrismaClient) {}

  async createDepositTx(input: { userId: string; amountBRL: number; clientRequestId: string }) {
    const { userId, amountBRL, clientRequestId } = input;
    return this.prisma.$transaction(async (tx) => {
      // idempotency check
      const existing = await tx.transaction.findFirst({
        where: { userId, clientRequestId },
      });
      if (existing) {
        const acc = await tx.account.findUnique({ where: { userId } });
        const newBalance = Number(acc?.fiatBalanceBRL ?? 0);
        return {
          id: existing.id,
          amountBRL: Number(existing.amountBRL),
          createdAt: existing.createdAt,
          newBalance,
          idempotent: true,
        };
      }

      const account = await tx.account.findUniqueOrThrow({ where: { userId } });
      const created = await tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          clientRequestId,
          amountBRL,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          transactionId: created.id,
          direction: 'CREDIT',
          currency: 'BRL',
          amount: amountBRL,
        },
      });
      const updated = await tx.account.update({
        where: { id: account.id },
        data: { fiatBalanceBRL: { increment: amountBRL } },
      });
      return {
        id: created.id,
        amountBRL,
        createdAt: created.createdAt,
        newBalance: Number(updated.fiatBalanceBRL),
        idempotent: false,
      };
    });
  }
}
