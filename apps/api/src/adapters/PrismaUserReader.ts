import { PrismaClient } from '@prisma/client';
import { IUserReader } from '../../../../packages/application/src/use-cases/deposit';

export class PrismaUserReader implements IUserReader {
  constructor(private prisma: PrismaClient) {}
  async findById(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email };
  }
}
