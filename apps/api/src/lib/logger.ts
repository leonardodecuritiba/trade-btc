import pino from 'pino';

export const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
