import { Request, Response } from 'express';
import { GetCurrentQuoteUseCase } from '../../../../../packages/application/src/use-cases/get-current-quote';

export class QuotesController {
  constructor(private useCase: GetCurrentQuoteUseCase) {}
  async current(_req: Request, res: Response) {
    const dto = await this.useCase.execute();
    return res.status(200).json(dto);
  }
}

