import { Request, Response } from 'express';
import { z } from 'zod';
import { GetStatementUseCase, StatementType } from '../../../../../packages/application/src/use-cases/get-statement';
import { baseLogger } from '../../lib/logger';

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  types: z.union([z.string(), z.array(z.string())]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class StatementController {
  constructor(private uc: GetStatementUseCase) {}
  async list(req: Request, res: Response) {
    const parsed = querySchema.parse(req.query);
    const userId = (req as any).user?.id as string;
    const logger = (res.locals && res.locals.logger) || baseLogger;

    const types: StatementType[] | undefined = parsed.types
      ? (Array.isArray(parsed.types) ? parsed.types : parsed.types.split(',')).map((t) => t.trim().toUpperCase() as StatementType)
      : undefined;

    const to = parsed.to ? new Date(parsed.to) : undefined;
    const from = parsed.from ? new Date(parsed.from) : undefined;
    logger.info({ userId, from: from?.toISOString(), to: to?.toISOString(), types, limit: parsed.limit }, 'statement - list start');
    const result = await this.uc.execute(userId, { from, to, types, cursor: parsed.cursor, limit: parsed.limit });
    logger.info({ userId, count: result.items.length, next: !!result.page.nextCursor }, 'statement - list end');
    return res.status(200).json(result);
  }
}
