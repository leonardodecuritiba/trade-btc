import { PrismaClient } from '@prisma/client';
import { IOrderStore } from '../../../../packages/application/src/use-cases/buy-btc';

export class PrismaOrderRepository implements IOrderStore {
  constructor(private prisma: PrismaClient) {}

  async createOrGet(userId: string, clientRequestId: string, amountBRL: number) {
    try {
      const order = await this.prisma.order.create({
        data: { userId, type: 'BUY', amountBRL, clientRequestId, status: 'ENQUEUED' },
      });
      return { orderId: order.id, created: true };
    } catch (e: any) {
      // unique violation -> fetch existing
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

