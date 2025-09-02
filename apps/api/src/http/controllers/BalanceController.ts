import { Request, Response } from 'express';
import { GetBalanceUseCase } from '../../../../../packages/application/src/use-cases/get-balance';

export class BalanceController {
  constructor(private useCase: GetBalanceUseCase) {}
  async show(req: Request, res: Response): Promise<Response> {
    const userId = (req as any).user?.id as string;
    const result = await this.useCase.execute(userId);
    return res.status(200).json(result);
  }
}

