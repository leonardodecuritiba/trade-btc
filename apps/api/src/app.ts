import express, { Express, Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import { ZodError } from 'zod';
import { router } from './http/routes';
import { AppError } from '../../../packages/shared/src/errors';
import { requestContext } from './middleware/requestContext';
import { baseLogger } from './lib/logger';
import path from 'path';
// Use require to avoid needing TS types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const swaggerUi = require('swagger-ui-express');

const app: Express = express();

app.use(express.json());
app.use(requestContext);

// Serve OpenAPI YAMLs and Swagger UI (dev)
const openapiDir = path.resolve(__dirname, '../openapi');
app.use('/openapi', express.static(openapiDir));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/openapi/openapi.yaml' }));

app.use(router);

app.use((err: any, request: Request, response: Response, next: NextFunction) => {
  const requestId = (response.locals && response.locals.requestId) || undefined;
  const logger = (response.locals && response.locals.logger) || baseLogger;
  if (err instanceof ZodError) {
    logger.warn({ err, requestId }, 'Validation failed');
    return response.status(422).json({
      code: 'INVALID_INPUT',
      message: 'Validation failed',
      details: err.flatten(),
      requestId,
    });
  }
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId }, 'AppError');
    } else {
      logger.warn({ err, requestId }, 'AppError');
    }
    return response.status(err.status).json({
      code: err.code,
      message: err.message,
      requestId,
    });
  }
  logger.error({ err, requestId }, 'Unhandled error');
  return response.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    requestId,
  });
});

export { app };
