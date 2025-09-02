import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../../../packages/application/src/use-cases';
import { User } from '../../../../packages/domain/src/user';

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(user: Omit<User, 'id' | 'createdAt'>, account: { fiatBalanceBRL: number }): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        account: {
          create: {
            fiatBalanceBRL: account.fiatBalanceBRL,
          },
        },
      },
    });
  }
}
