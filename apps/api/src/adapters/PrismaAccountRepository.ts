import { PrismaClient } from '@prisma/client';
import { IAccountReader } from '../../../../packages/application/src/use-cases/get-balance';

export class PrismaAccountRepository implements IAccountReader {
  constructor(private prisma: PrismaClient) {}
  async getByUserId(userId: string) {
    const acc = await this.prisma.account.findUnique({ where: { userId } });
    if (!acc) return null;
    return { fiatBalanceBRL: Number(acc.fiatBalanceBRL), updatedAt: acc.updatedAt };
  }
}

