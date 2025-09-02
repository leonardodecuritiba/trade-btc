import { Request, Response } from 'express';
import { GetPositionsUseCase } from '../../../../../packages/application/src/use-cases/get-positions';

export class PositionsController {
  constructor(private useCase: GetPositionsUseCase) {}
  async list(req: Request, res: Response) {
    const userId = (req as any).user?.id as string;
    const items = await this.useCase.execute(userId);
    return res.status(200).json(items);
  }
}

