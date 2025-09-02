import { Request, Response } from 'express';
import { GetDailyVolumeUseCase } from '../../../../../packages/application/src/use-cases/get-daily-volume';
import { baseLogger } from '../../lib/logger';

export class MetricsController {
  constructor(private dailyVolumeUC: GetDailyVolumeUseCase) {}

  async dailyVolume(_req: Request, res: Response) {
    const logger = (res.locals && res.locals.logger) || baseLogger;
    logger.info({}, 'daily-volume - start');
    const dto = await this.dailyVolumeUC.execute(new Date());
    logger.info({ boughtBTC: dto.boughtBTC, soldBTC: dto.soldBTC, date: dto.date }, 'daily-volume - end');
    return res.status(200).json(dto);
  }
}

