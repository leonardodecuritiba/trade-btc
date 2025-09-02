import { Request, Response } from 'express';
import { z } from 'zod';
import { DepositUseCase } from '../../../../../packages/application/src/use-cases/deposit';

const depositSchema = z.object({
  amountBRL: z.number().positive(),
  clientRequestId: z.string().min(1),
});

export class DepositController {
  constructor(private useCase: DepositUseCase) {}

  async create(req: Request, res: Response): Promise<Response> {
    const data = depositSchema.parse(req.body);
    const userId = (req as any).user?.id as string;
    const result = await this.useCase.execute({ userId, amountBRL: data.amountBRL, clientRequestId: data.clientRequestId });
    const status = result.idempotent ? 200 : 201;
    return res.status(status).json({ id: result.id, amountBRL: result.amountBRL, newBalance: result.newBalance, createdAt: result.createdAt });
  }
}

