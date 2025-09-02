import { Request, Response } from 'express';
import { GetHistory24hUseCase } from '../../../../../packages/application/src/use-cases/get-history-24h';
import { baseLogger } from '../../lib/logger';

export class HistoryController {
  constructor(private uc: GetHistory24hUseCase) {}
  async history(req: Request, res: Response) {
    const logger = (res.locals && res.locals.logger) || baseLogger;
    logger.info({}, 'quotes-history - start');
    const dto = await this.uc.execute(new Date());
    logger.info({ slots: dto.slots }, 'quotes-history - end');
    return res.status(200).json(dto);
  }
}

