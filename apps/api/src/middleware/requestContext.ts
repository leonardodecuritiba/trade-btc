import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { baseLogger } from '../lib/logger';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  const correlationId = (req.headers['x-correlation-id'] as string) || requestId;
  const userId = undefined; // populated on authenticated routes elsewhere

  const logger = baseLogger.child({ requestId, correlationId, userId });

  res.locals.requestId = requestId;
  res.locals.correlationId = correlationId;
  res.locals.logger = logger;
  res.locals.userId = userId;

  next();
}

