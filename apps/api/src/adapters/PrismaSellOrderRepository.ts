import { PrismaClient } from '@prisma/client';
import { IOrderStoreSell } from '../../../../packages/application/src/use-cases/sell-btc';

export class PrismaSellOrderRepository implements IOrderStoreSell {
  constructor(private prisma: PrismaClient) {}

  async createOrGet(userId: string, clientRequestId: string, amountBRL: number) {
    try {
      const order = await this.prisma.order.create({
        data: { userId, type: 'SELL', amountBRL, clientRequestId, status: 'ENQUEUED' },
      });
      return { orderId: order.id, created: true };
    } catch (e: any) {
      const existing = await this.prisma.order.findFirst({ where: { userId, clientRequestId } });
      if (existing) return { orderId: existing.id, created: false };
      throw e;
    }
  }

  async markProcessed(orderId: string) {
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSED' } });
  }

  async getByClientRequest(userId: string, clientRequestId: string) {
    const order = await this.prisma.order.findFirst({ where: { userId, clientRequestId } });
    if (!order) return null;
    return { orderId: order.id, amountBRL: Number(order.amountBRL) };
  }
}

